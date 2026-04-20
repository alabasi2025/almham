import { Hono } from 'hono';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  cashboxes,
  cashMovements,
  collections,
  cashTransfers,
  expenses,
  expenseCategories,
  stations,
  users,
  employees,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

// ==================== Cashboxes ====================

app.get('/cashboxes', async (c) => {
  const rows = await db
    .select({
      id: cashboxes.id,
      name: cashboxes.name,
      type: cashboxes.type,
      stationId: cashboxes.stationId,
      stationName: stations.name,
      walletProvider: cashboxes.walletProvider,
      accountNumber: cashboxes.accountNumber,
      accountHolder: cashboxes.accountHolder,
      currency: cashboxes.currency,
      openingBalance: cashboxes.openingBalance,
      isActive: cashboxes.isActive,
      notes: cashboxes.notes,
      createdAt: cashboxes.createdAt,
    })
    .from(cashboxes)
    .leftJoin(stations, eq(cashboxes.stationId, stations.id))
    .orderBy(cashboxes.type, cashboxes.name);
  return c.json(rows);
});

app.get('/cashboxes/balances', async (c) => {
  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.type,
      c.station_id AS "stationId",
      s.name AS "stationName",
      c.wallet_provider AS "walletProvider",
      c.account_number AS "accountNumber",
      c.account_holder AS "accountHolder",
      c.currency,
      c.is_active AS "isActive",
      c.opening_balance::numeric AS "openingBalance",
      COALESCE(SUM(CASE WHEN m.direction = 'in' THEN m.amount::numeric ELSE 0 END), 0) AS "totalIn",
      COALESCE(SUM(CASE WHEN m.direction = 'out' THEN m.amount::numeric ELSE 0 END), 0) AS "totalOut",
      (c.opening_balance::numeric
        + COALESCE(SUM(CASE WHEN m.direction = 'in' THEN m.amount::numeric ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN m.direction = 'out' THEN m.amount::numeric ELSE 0 END), 0)
      ) AS "currentBalance"
    FROM cashboxes c
    LEFT JOIN cash_movements m ON m.cashbox_id = c.id
    LEFT JOIN stations s ON c.station_id = s.id
    GROUP BY c.id, s.name
    ORDER BY c.type, c.name
  `);
  return c.json(rows);
});

const cashboxUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  openingBalance: z.union([z.string(), z.number()]).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

app.put('/cashboxes/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = cashboxUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة' }, 400);

  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update['name'] = data.name;
  if (data.accountNumber !== undefined) update['accountNumber'] = data.accountNumber;
  if (data.accountHolder !== undefined) update['accountHolder'] = data.accountHolder;
  if (data.openingBalance !== undefined) update['openingBalance'] = String(data.openingBalance);
  if (data.isActive !== undefined) update['isActive'] = data.isActive;
  if (data.notes !== undefined) update['notes'] = data.notes;

  const [row] = await db.update(cashboxes).set(update).where(eq(cashboxes.id, id)).returning();
  if (!row) return c.json({ error: 'الصندوق غير موجود' }, 404);
  return c.json(row);
});

// ==================== Collections ====================

const collectionSchema = z.object({
  stationId: z.string().uuid(),
  cashboxId: z.string().uuid(),
  collectorUserId: z.string().uuid().optional().nullable(),
  subscriberName: z.string().optional().nullable(),
  meterNumber: z.string().optional().nullable(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(['YER', 'SAR', 'USD']).optional(),
  paymentMethod: z.enum(['cash', 'wallet', 'hexcell', 'other']),
  walletRef: z.string().optional().nullable(),
  receiptCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  occurredAt: z.string().optional(),
});

app.get('/collections', async (c) => {
  const stationId = c.req.query('stationId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const conditions = [];
  if (stationId) conditions.push(eq(collections.stationId, stationId));
  if (from) conditions.push(gte(collections.occurredAt, new Date(from)));
  if (to) conditions.push(lte(collections.occurredAt, new Date(to)));

  const rows = await db
    .select({
      id: collections.id,
      stationId: collections.stationId,
      stationName: stations.name,
      cashboxId: collections.cashboxId,
      cashboxName: cashboxes.name,
      collectorUserId: collections.collectorUserId,
      collectorUsername: users.username,
      collectorName: employees.name,
      subscriberName: collections.subscriberName,
      meterNumber: collections.meterNumber,
      amount: collections.amount,
      currency: collections.currency,
      paymentMethod: collections.paymentMethod,
      walletRef: collections.walletRef,
      receiptCode: collections.receiptCode,
      notes: collections.notes,
      occurredAt: collections.occurredAt,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .leftJoin(stations, eq(collections.stationId, stations.id))
    .leftJoin(cashboxes, eq(collections.cashboxId, cashboxes.id))
    .leftJoin(users, eq(collections.collectorUserId, users.id))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(collections.occurredAt))
    .limit(500);

  return c.json(rows);
});

app.post('/collections', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = collectionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

  const [created] = await db
    .insert(collections)
    .values({
      stationId: data.stationId,
      cashboxId: data.cashboxId,
      collectorUserId: data.collectorUserId ?? auth.user.id,
      subscriberName: data.subscriberName ?? null,
      meterNumber: data.meterNumber ?? null,
      amount: String(data.amount),
      currency: data.currency ?? 'YER',
      paymentMethod: data.paymentMethod,
      walletRef: data.walletRef ?? null,
      receiptCode: data.receiptCode ?? null,
      notes: data.notes ?? null,
      occurredAt,
    })
    .returning();

  // Record cash movement (increases the destination cashbox)
  await db.insert(cashMovements).values({
    cashboxId: data.cashboxId,
    direction: 'in',
    amount: String(data.amount),
    currency: data.currency ?? 'YER',
    refType: 'collection',
    refId: created.id,
    userId: auth.user.id,
    occurredAt,
    notes: `تحصيل ${data.subscriberName ?? data.meterNumber ?? ''}`.trim(),
  });

  await recordAudit({
    userId: auth.user.id,
    action: 'collection.create',
    entityType: 'collection',
    entityId: created.id,
    metadata: { amount: Number(data.amount), stationId: data.stationId, cashboxId: data.cashboxId },
  });

  return c.json(created, 201);
});

app.delete('/collections/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const auth = c.get('auth');

  // Delete linked movements
  await db.delete(cashMovements).where(and(eq(cashMovements.refType, 'collection'), eq(cashMovements.refId, id)));
  const [deleted] = await db.delete(collections).where(eq(collections.id, id)).returning();
  if (!deleted) return c.json({ error: 'سند التحصيل غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'collection.delete',
    entityType: 'collection',
    entityId: id,
  });
  return c.json({ success: true });
});

// ==================== Expenses ====================

const expenseSchema = z.object({
  stationId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  cashboxId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(['YER', 'SAR', 'USD']).optional(),
  description: z.string().min(1),
  receiptPhotoUrl: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
});

app.get('/expenses', async (c) => {
  const stationId = c.req.query('stationId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const conditions = [];
  if (stationId) conditions.push(eq(expenses.stationId, stationId));
  if (from) conditions.push(gte(expenses.occurredAt, new Date(from)));
  if (to) conditions.push(lte(expenses.occurredAt, new Date(to)));

  const rows = await db
    .select({
      id: expenses.id,
      stationId: expenses.stationId,
      stationName: stations.name,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      categoryIcon: expenseCategories.icon,
      categoryColor: expenseCategories.color,
      cashboxId: expenses.cashboxId,
      cashboxName: cashboxes.name,
      userId: expenses.userId,
      amount: expenses.amount,
      currency: expenses.currency,
      description: expenses.description,
      receiptPhotoUrl: expenses.receiptPhotoUrl,
      occurredAt: expenses.occurredAt,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(stations, eq(expenses.stationId, stations.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(cashboxes, eq(expenses.cashboxId, cashboxes.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(expenses.occurredAt))
    .limit(500);

  return c.json(rows);
});

app.post('/expenses', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

  const [created] = await db
    .insert(expenses)
    .values({
      stationId: data.stationId ?? null,
      categoryId: data.categoryId ?? null,
      cashboxId: data.cashboxId,
      userId: auth.user.id,
      amount: String(data.amount),
      currency: data.currency ?? 'YER',
      description: data.description,
      receiptPhotoUrl: data.receiptPhotoUrl ?? null,
      occurredAt,
    })
    .returning();

  // Record cash movement (decreases the source cashbox)
  await db.insert(cashMovements).values({
    cashboxId: data.cashboxId,
    direction: 'out',
    amount: String(data.amount),
    currency: data.currency ?? 'YER',
    refType: 'expense',
    refId: created.id,
    userId: auth.user.id,
    occurredAt,
    notes: data.description,
  });

  await recordAudit({
    userId: auth.user.id,
    action: 'expense.create',
    entityType: 'expense',
    entityId: created.id,
    metadata: { amount: Number(data.amount), cashboxId: data.cashboxId },
  });

  return c.json(created, 201);
});

app.delete('/expenses/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const auth = c.get('auth');

  await db.delete(cashMovements).where(and(eq(cashMovements.refType, 'expense'), eq(cashMovements.refId, id)));
  const [deleted] = await db.delete(expenses).where(eq(expenses.id, id)).returning();
  if (!deleted) return c.json({ error: 'المصروف غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'expense.delete',
    entityType: 'expense',
    entityId: id,
  });
  return c.json({ success: true });
});

// ==================== Cash Transfers ====================

const transferSchema = z.object({
  fromCashboxId: z.string().uuid(),
  toCashboxId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(['YER', 'SAR', 'USD']).optional(),
  receiptPhotoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
});

app.get('/transfers', async (c) => {
  const rows = await db
    .select()
    .from(cashTransfers)
    .orderBy(desc(cashTransfers.occurredAt))
    .limit(500);
  return c.json(rows);
});

app.post('/transfers', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  if (data.fromCashboxId === data.toCashboxId) {
    return c.json({ error: 'لا يمكن التحويل لنفس الصندوق' }, 400);
  }
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

  const [created] = await db
    .insert(cashTransfers)
    .values({
      fromCashboxId: data.fromCashboxId,
      toCashboxId: data.toCashboxId,
      amount: String(data.amount),
      currency: data.currency ?? 'YER',
      transferredByUserId: auth.user.id,
      receiptPhotoUrl: data.receiptPhotoUrl ?? null,
      notes: data.notes ?? null,
      occurredAt,
    })
    .returning();

  // Record two movements (out from source, in to destination)
  await db.insert(cashMovements).values([
    {
      cashboxId: data.fromCashboxId,
      direction: 'out',
      amount: String(data.amount),
      currency: data.currency ?? 'YER',
      refType: 'transfer_out',
      refId: created.id,
      userId: auth.user.id,
      occurredAt,
      notes: data.notes ?? null,
    },
    {
      cashboxId: data.toCashboxId,
      direction: 'in',
      amount: String(data.amount),
      currency: data.currency ?? 'YER',
      refType: 'transfer_in',
      refId: created.id,
      userId: auth.user.id,
      occurredAt,
      notes: data.notes ?? null,
    },
  ]);

  await recordAudit({
    userId: auth.user.id,
    action: 'transfer.create',
    entityType: 'cash_transfer',
    entityId: created.id,
    metadata: { amount: Number(data.amount), from: data.fromCashboxId, to: data.toCashboxId },
  });

  return c.json(created, 201);
});

app.delete('/transfers/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const auth = c.get('auth');

  await db
    .delete(cashMovements)
    .where(
      and(
        sql`${cashMovements.refType} IN ('transfer_in', 'transfer_out')`,
        eq(cashMovements.refId, id),
      ),
    );
  const [deleted] = await db.delete(cashTransfers).where(eq(cashTransfers.id, id)).returning();
  if (!deleted) return c.json({ error: 'التحويل غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'transfer.delete',
    entityType: 'cash_transfer',
    entityId: id,
  });
  return c.json({ success: true });
});

// ==================== Expense Categories ====================

app.get('/expense-categories', async (c) => {
  const rows = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.isActive, true))
    .orderBy(expenseCategories.name);
  return c.json(rows);
});

// ==================== Summary ====================

app.get('/summary', async (c) => {
  const dateStr = c.req.query('date');
  const day = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
  const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);

  const [collectionsSum] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(collections)
    .where(and(gte(collections.occurredAt, startOfDay), lte(collections.occurredAt, endOfDay)));

  const [expensesSum] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expenses)
    .where(and(gte(expenses.occurredAt, startOfDay), lte(expenses.occurredAt, endOfDay)));

  const perStation = await db.execute(sql`
    SELECT
      s.id AS "stationId",
      s.name AS "stationName",
      COALESCE(SUM(col.amount::numeric), 0) AS "collectionsTotal",
      COUNT(col.id) AS "collectionsCount"
    FROM stations s
    LEFT JOIN collections col ON col.station_id = s.id
      AND col.occurred_at BETWEEN ${startOfDay} AND ${endOfDay}
    GROUP BY s.id, s.name
    ORDER BY "collectionsTotal" DESC
  `);

  return c.json({
    date: startOfDay.toISOString().slice(0, 10),
    totalCollections: Number(collectionsSum.total),
    collectionsCount: collectionsSum.count,
    totalExpenses: Number(expensesSum.total),
    expensesCount: expensesSum.count,
    net: Number(collectionsSum.total) - Number(expensesSum.total),
    perStation: (perStation as unknown as Array<Record<string, unknown>>).map((r) => ({
      stationId: r['stationId'],
      stationName: r['stationName'],
      collectionsTotal: Number(r['collectionsTotal']),
      collectionsCount: Number(r['collectionsCount']),
    })),
  });
});

export default app;
