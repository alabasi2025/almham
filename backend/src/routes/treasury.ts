import { Hono, type Context } from 'hono';
import { and, desc, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  cashboxes,
  cashMovements,
  collections,
  cashTransfers,
  dailyClosures,
  expenses,
  expenseCategories,
  billingSystemAccounts,
  billingSystems,
  stations,
  users,
  employees,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import {
  hasGlobalAccess,
  requireGlobalAccess,
  requireStationAccess,
  stationScopeCondition,
} from '../lib/access-control.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const uuidQuerySchema = z.string().uuid();

function getDayRange(dateStr?: string | null): { date: string; start: Date; end: Date } {
  const source = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const day = Number.isNaN(source.getTime()) ? new Date() : source;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  return { date: start.toISOString().slice(0, 10), start, end };
}

async function calculateClosureTotals(stationId: string, start: Date, end: Date) {
  const [totals] = await db
    .select({
      totalCash: sql<string>`COALESCE(SUM(CASE WHEN ${collections.paymentMethod} = 'cash' THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      totalWallet: sql<string>`COALESCE(SUM(CASE WHEN ${collections.paymentMethod} = 'wallet' THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      totalHexcell: sql<string>`COALESCE(SUM(CASE WHEN ${collections.paymentMethod} = 'hexcell' THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      totalOther: sql<string>`COALESCE(SUM(CASE WHEN ${collections.paymentMethod} = 'other' THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(collections)
    .where(
      and(
        eq(collections.stationId, stationId),
        gte(collections.occurredAt, start),
        lte(collections.occurredAt, end),
      ),
    );

  const totalCash = Number(totals?.totalCash ?? 0);
  const totalWallet = Number(totals?.totalWallet ?? 0);
  const totalHexcell = Number(totals?.totalHexcell ?? 0);
  const totalOther = Number(totals?.totalOther ?? 0);

  return {
    totalCash,
    totalWallet,
    totalHexcell,
    totalOther,
    expectedTotal: totalCash + totalWallet + totalHexcell + totalOther,
    collectionsCount: totals?.count ?? 0,
  };
}

async function requireCashboxAccess(c: Context<HonoEnv>, cashboxId: string): Promise<Response | null> {
  const [cashbox] = await db
    .select({ id: cashboxes.id, stationId: cashboxes.stationId })
    .from(cashboxes)
    .where(eq(cashboxes.id, cashboxId))
    .limit(1);

  if (!cashbox) return c.json({ error: 'الصندوق غير موجود' }, 404);
  return requireStationAccess(c, cashbox.stationId);
}

async function ensureStationExists(c: Context<HonoEnv>, stationId: string): Promise<Response | null> {
  const [station] = await db
    .select({ id: stations.id })
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);
  return station ? null : c.json({ error: 'المحطة غير موجودة' }, 404);
}

// ==================== Cashboxes ====================

app.get('/cashboxes', async (c) => {
  const auth = c.get('auth');
  const scope = stationScopeCondition(auth, cashboxes.stationId);
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
    .where(scope)
    .orderBy(cashboxes.type, cashboxes.name);
  return c.json(rows);
});

app.get('/cashboxes/balances', async (c) => {
  const auth = c.get('auth');
  const stationWhere = hasGlobalAccess(auth.user)
    ? sql``
    : auth.user.stationId
      ? sql`WHERE c.station_id = ${auth.user.stationId}`
      : sql`WHERE false`;

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
    ${stationWhere}
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
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

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
  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'cashbox.update',
    entityType: 'cashbox',
    entityId: id,
    metadata: {
      changedFields: Object.keys(update),
      openingBalanceChanged: update['openingBalance'] !== undefined,
      isActiveChanged: update['isActive'] !== undefined,
    },
  });
  return c.json(row);
});

// ==================== Collections ====================

const collectionSchema = z.object({
  stationId: z.string().uuid(),
  cashboxId: z.string().uuid(),
  billingSystemId: z.string().uuid().optional().nullable(),
  billingAccountId: z.string().uuid().optional().nullable(),
  collectorUserId: z.string().uuid().optional().nullable(),
  collectorEmployeeId: z.string().uuid().optional().nullable(),
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
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, collections.stationId, stationId);
  if (scope) conditions.push(scope);
  if (from) conditions.push(gte(collections.occurredAt, new Date(from)));
  if (to) conditions.push(lte(collections.occurredAt, new Date(to)));

  const rows = await db
    .select({
      id: collections.id,
      stationId: collections.stationId,
      stationName: stations.name,
      cashboxId: collections.cashboxId,
      cashboxName: cashboxes.name,
      billingSystemId: collections.billingSystemId,
      billingSystemName: billingSystems.name,
      billingSystemColor: billingSystems.color,
      billingSystemIcon: billingSystems.icon,
      billingAccountId: collections.billingAccountId,
      billingAccountName: billingSystemAccounts.name,
      billingAccountType: billingSystemAccounts.type,
      collectorUserId: collections.collectorUserId,
      collectorEmployeeId: collections.collectorEmployeeId,
      collectorUsername: users.username,
      collectorName: sql<string | null>`COALESCE((SELECT e.name FROM employees e WHERE e.id = ${collections.collectorEmployeeId}), ${employees.name})`,
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
    .leftJoin(billingSystems, eq(collections.billingSystemId, billingSystems.id))
    .leftJoin(billingSystemAccounts, eq(collections.billingAccountId, billingSystemAccounts.id))
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
  const stationDenied = requireStationAccess(c, data.stationId);
  if (stationDenied) return stationDenied;
  const cashboxDenied = await requireCashboxAccess(c, data.cashboxId);
  if (cashboxDenied) return cashboxDenied;
  if (data.collectorEmployeeId) {
    const [collector] = await db
      .select({ id: employees.id, stationId: employees.stationId, status: employees.status })
      .from(employees)
      .where(eq(employees.id, data.collectorEmployeeId))
      .limit(1);
    if (!collector) return c.json({ error: 'المتحصل غير موجود' }, 404);
    if (collector.status !== 'active' || collector.stationId !== data.stationId) {
      return c.json({ error: 'المتحصل لا يتبع هذه المحطة أو غير نشط' }, 400);
    }
  }

  let resolvedBillingSystemId = data.billingSystemId ?? null;
  if (data.billingAccountId) {
    const [account] = await db
      .select({
        id: billingSystemAccounts.id,
        billingSystemId: billingSystemAccounts.billingSystemId,
        type: billingSystemAccounts.type,
        isActive: billingSystemAccounts.isActive,
      })
      .from(billingSystemAccounts)
      .where(eq(billingSystemAccounts.id, data.billingAccountId))
      .limit(1);
    if (!account || !account.isActive) return c.json({ error: 'حساب الفوترة غير موجود أو غير نشط' }, 404);
    if (account.type !== 'collection') return c.json({ error: 'سند التحصيل يجب أن يرتبط بحساب تحصيل فقط' }, 400);
    if (data.billingSystemId && data.billingSystemId !== account.billingSystemId) {
      return c.json({ error: 'حساب الفوترة لا يتبع النظام المحدد' }, 400);
    }
    resolvedBillingSystemId = account.billingSystemId;
  }

  if (resolvedBillingSystemId) {
    const [billingSystem] = await db
      .select({
        id: billingSystems.id,
        stationId: billingSystems.stationId,
        isActive: billingSystems.isActive,
      })
      .from(billingSystems)
      .where(eq(billingSystems.id, resolvedBillingSystemId))
      .limit(1);
    if (!billingSystem || !billingSystem.isActive) {
      return c.json({ error: 'نظام الفوترة غير موجود أو غير نشط' }, 404);
    }
    if (billingSystem.stationId && billingSystem.stationId !== data.stationId) {
      return c.json({ error: 'نظام الفوترة لا يتبع هذه المحطة' }, 400);
    }
  }

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

  const [created] = await db
    .insert(collections)
    .values({
      stationId: data.stationId,
      cashboxId: data.cashboxId,
      billingSystemId: resolvedBillingSystemId,
      billingAccountId: data.billingAccountId ?? null,
      collectorUserId: data.collectorUserId ?? auth.user.id,
      collectorEmployeeId: data.collectorEmployeeId ?? null,
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
  const [current] = await db
    .select({ stationId: collections.stationId })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'سند التحصيل غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

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
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, expenses.stationId, stationId);
  if (scope) conditions.push(scope);
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
  const cashboxDenied = await requireCashboxAccess(c, data.cashboxId);
  if (cashboxDenied) return cashboxDenied;

  const [cashbox] = await db
    .select({ stationId: cashboxes.stationId })
    .from(cashboxes)
    .where(eq(cashboxes.id, data.cashboxId))
    .limit(1);
  const stationId = data.stationId ?? cashbox?.stationId ?? auth.user.stationId ?? null;
  const stationDenied = requireStationAccess(c, stationId);
  if (stationDenied) return stationDenied;

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

  const [created] = await db
    .insert(expenses)
    .values({
      stationId,
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
  const [current] = await db
    .select({ stationId: expenses.stationId })
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'المصروف غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

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

// ==================== Daily Closures ====================

const closureSchema = z.object({
  stationId: z.string().uuid(),
  closureDate: z.string().min(1),
  actualTotal: z.union([z.string(), z.number()]),
  notes: z.string().nullable().optional(),
});

app.get('/closures/preview', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  if (!stationId) return c.json({ error: 'المحطة مطلوبة' }, 400);
  const stationParsed = uuidQuerySchema.safeParse(stationId);
  if (!stationParsed.success) return c.json({ error: 'معرّف المحطة غير صحيح' }, 400);

  const denied = requireStationAccess(c, stationParsed.data);
  if (denied) return denied;
  const missingStation = await ensureStationExists(c, stationParsed.data);
  if (missingStation) return missingStation;

  const range = getDayRange(c.req.query('date'));
  const totals = await calculateClosureTotals(stationParsed.data, range.start, range.end);

  const [existing] = await db
    .select({
      id: dailyClosures.id,
      status: dailyClosures.status,
      actualTotal: dailyClosures.actualTotal,
      variance: dailyClosures.variance,
    })
    .from(dailyClosures)
    .where(
      and(
        eq(dailyClosures.stationId, stationParsed.data),
        gte(dailyClosures.closureDate, range.start),
        lte(dailyClosures.closureDate, range.end),
      ),
    )
    .limit(1);

  return c.json({
    stationId: stationParsed.data,
    date: range.date,
    ...totals,
    existingClosure: existing ?? null,
  });
});

app.get('/closures', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (stationId && !uuidQuerySchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صحيح' }, 400);
  }

  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, dailyClosures.stationId, stationId);
  if (scope) conditions.push(scope);
  if (from) conditions.push(gte(dailyClosures.closureDate, getDayRange(from).start));
  if (to) conditions.push(lte(dailyClosures.closureDate, getDayRange(to).end));

  const rows = await db
    .select({
      id: dailyClosures.id,
      stationId: dailyClosures.stationId,
      stationName: stations.name,
      managerUserId: dailyClosures.managerUserId,
      managerUsername: users.username,
      closureDate: dailyClosures.closureDate,
      totalCash: dailyClosures.totalCash,
      totalWallet: dailyClosures.totalWallet,
      totalHexcell: dailyClosures.totalHexcell,
      expectedTotal: dailyClosures.expectedTotal,
      actualTotal: dailyClosures.actualTotal,
      variance: dailyClosures.variance,
      status: dailyClosures.status,
      notes: dailyClosures.notes,
      createdAt: dailyClosures.createdAt,
    })
    .from(dailyClosures)
    .leftJoin(stations, eq(dailyClosures.stationId, stations.id))
    .leftJoin(users, eq(dailyClosures.managerUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dailyClosures.closureDate))
    .limit(120);

  return c.json(rows);
});

app.post('/closures', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = closureSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الإقفال غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;
  const missingStation = await ensureStationExists(c, data.stationId);
  if (missingStation) return missingStation;

  const actualTotal = Number(data.actualTotal);
  if (!Number.isFinite(actualTotal) || actualTotal < 0) {
    return c.json({ error: 'المبلغ الفعلي غير صحيح' }, 400);
  }

  const range = getDayRange(data.closureDate);
  const [existing] = await db
    .select({ id: dailyClosures.id, status: dailyClosures.status })
    .from(dailyClosures)
    .where(
      and(
        eq(dailyClosures.stationId, data.stationId),
        gte(dailyClosures.closureDate, range.start),
        lte(dailyClosures.closureDate, range.end),
      ),
    )
    .limit(1);
  if (existing) {
    return c.json({ error: 'تم إقفال هذا اليوم لهذه المحطة مسبقاً', closureId: existing.id }, 409);
  }

  const totals = await calculateClosureTotals(data.stationId, range.start, range.end);
  const variance = actualTotal - totals.expectedTotal;

  const [created] = await db
    .insert(dailyClosures)
    .values({
      stationId: data.stationId,
      managerUserId: auth.user.id,
      closureDate: range.start,
      totalCash: String(totals.totalCash),
      totalWallet: String(totals.totalWallet),
      totalHexcell: String(totals.totalHexcell),
      expectedTotal: String(totals.expectedTotal),
      actualTotal: String(actualTotal),
      variance: String(variance),
      status: 'closed',
      notes: data.notes ?? null,
    })
    .returning();

  await recordAudit({
    userId: auth.user.id,
    action: 'daily_closure.create',
    entityType: 'daily_closure',
    entityId: created.id,
    metadata: {
      stationId: data.stationId,
      date: range.date,
      expectedTotal: totals.expectedTotal,
      actualTotal,
      variance,
      collectionsCount: totals.collectionsCount,
    },
  });

  return c.json(created, 201);
});

app.put('/closures/:id/approve', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const auth = c.get('auth');

  const [updated] = await db
    .update(dailyClosures)
    .set({ status: 'approved' })
    .where(eq(dailyClosures.id, id))
    .returning();
  if (!updated) return c.json({ error: 'الإقفال غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'daily_closure.approve',
    entityType: 'daily_closure',
    entityId: id,
    metadata: { stationId: updated.stationId, variance: Number(updated.variance) },
  });

  return c.json(updated);
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
  const auth = c.get('auth');
  const rows = hasGlobalAccess(auth.user)
    ? await db.select().from(cashTransfers).orderBy(desc(cashTransfers.occurredAt)).limit(500)
    : await db.execute(sql`
        SELECT
          t.id,
          t.from_cashbox_id AS "fromCashboxId",
          t.to_cashbox_id AS "toCashboxId",
          t.amount,
          t.currency,
          t.transferred_by_user_id AS "transferredByUserId",
          t.receipt_photo_url AS "receiptPhotoUrl",
          t.notes,
          t.occurred_at AS "occurredAt",
          t.created_at AS "createdAt"
        FROM cash_transfers t
        JOIN cashboxes from_box ON from_box.id = t.from_cashbox_id
        JOIN cashboxes to_box ON to_box.id = t.to_cashbox_id
        WHERE ${auth.user.stationId ? sql`(from_box.station_id = ${auth.user.stationId} OR to_box.station_id = ${auth.user.stationId})` : sql`false`}
        ORDER BY t.occurred_at DESC
        LIMIT 500
      `);
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
  const fromDenied = await requireCashboxAccess(c, data.fromCashboxId);
  if (fromDenied) return fromDenied;
  const toDenied = await requireCashboxAccess(c, data.toCashboxId);
  if (toDenied) return toDenied;

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
  const [current] = await db
    .select({
      fromCashboxId: cashTransfers.fromCashboxId,
      toCashboxId: cashTransfers.toCashboxId,
    })
    .from(cashTransfers)
    .where(eq(cashTransfers.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'التحويل غير موجود' }, 404);
  const fromDenied = await requireCashboxAccess(c, current.fromCashboxId);
  if (fromDenied) return fromDenied;
  const toDenied = await requireCashboxAccess(c, current.toCashboxId);
  if (toDenied) return toDenied;

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

// ==================== Billing Systems ====================

const billingSystemSchema = z.object({
  name: z.string().min(1).max(128),
  code: z.string().max(64).nullable().optional(),
  type: z.enum(['ecas', 'hexcell', 'manual', 'other']),
  stationId: z.string().uuid().nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
  color: z.string().max(16).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

app.get('/billing-systems', async (c) => {
  const auth = c.get('auth');
  const where = hasGlobalAccess(auth.user)
    ? undefined
    : auth.user.stationId
      ? or(eq(billingSystems.stationId, auth.user.stationId), isNull(billingSystems.stationId))
      : isNull(billingSystems.stationId);
  const rows = await db
    .select({
      id: billingSystems.id,
      name: billingSystems.name,
      code: billingSystems.code,
      type: billingSystems.type,
      stationId: billingSystems.stationId,
      stationName: stations.name,
      icon: billingSystems.icon,
      color: billingSystems.color,
      isActive: billingSystems.isActive,
      notes: billingSystems.notes,
      createdAt: billingSystems.createdAt,
    })
    .from(billingSystems)
    .leftJoin(stations, eq(billingSystems.stationId, stations.id))
    .where(where)
    .orderBy(billingSystems.type, billingSystems.name);
  return c.json(rows);
});

app.post('/billing-systems', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = billingSystemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  try {
    const [created] = await db
      .insert(billingSystems)
      .values({
        name: data.name,
        code: data.code ?? null,
        type: data.type,
        stationId: data.stationId ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        isActive: data.isActive ?? true,
        notes: data.notes ?? null,
      })
      .returning();

    await recordAudit({
      userId: auth.user.id,
      action: 'billing_system.create',
      entityType: 'billing_system',
      entityId: created.id,
      metadata: { name: data.name, type: data.type },
    });

    return c.json(created, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      return c.json({ error: 'الاسم مستخدم من قبل' }, 409);
    }
    throw err;
  }
});

app.put('/billing-systems/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = billingSystemSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة' }, 400);

  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update['name'] = data.name;
  if (data.code !== undefined) update['code'] = data.code;
  if (data.type !== undefined) update['type'] = data.type;
  if (data.stationId !== undefined) update['stationId'] = data.stationId;
  if (data.icon !== undefined) update['icon'] = data.icon;
  if (data.color !== undefined) update['color'] = data.color;
  if (data.isActive !== undefined) update['isActive'] = data.isActive;
  if (data.notes !== undefined) update['notes'] = data.notes;

  const [row] = await db.update(billingSystems).set(update).where(eq(billingSystems.id, id)).returning();
  if (!row) return c.json({ error: 'النظام غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'billing_system.update',
    entityType: 'billing_system',
    entityId: id,
    metadata: update,
  });

  return c.json(row);
});

app.delete('/billing-systems/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف غير صالح' }, 400);
  const auth = c.get('auth');

  // Check if used
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(collections)
    .where(eq(collections.billingSystemId, id));
  if (count > 0) {
    return c.json({ error: `لا يمكن الحذف: مرتبط بـ ${count} سند تحصيل. عطّله بدلاً من ذلك.` }, 409);
  }

  const [deleted] = await db.delete(billingSystems).where(eq(billingSystems.id, id)).returning();
  if (!deleted) return c.json({ error: 'النظام غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'billing_system.delete',
    entityType: 'billing_system',
    entityId: id,
  });

  return c.json({ success: true });
});

// ==================== Summary ====================

app.get('/summary', async (c) => {
  const auth = c.get('auth');
  const dateStr = c.req.query('date');
  const day = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
  const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  const startOfDayIso = startOfDay.toISOString();
  const endOfDayIso = endOfDay.toISOString();

  const collectionsConditions: SQL[] = [gte(collections.occurredAt, startOfDay), lte(collections.occurredAt, endOfDay)];
  const collectionsScope = stationScopeCondition(auth, collections.stationId);
  if (collectionsScope) collectionsConditions.push(collectionsScope);

  const expensesConditions: SQL[] = [gte(expenses.occurredAt, startOfDay), lte(expenses.occurredAt, endOfDay)];
  const expensesScope = stationScopeCondition(auth, expenses.stationId);
  if (expensesScope) expensesConditions.push(expensesScope);

  const [collectionsSum] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(collections)
    .where(and(...collectionsConditions));

  const [expensesSum] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expenses)
    .where(and(...expensesConditions));

  const stationSummaryWhere = hasGlobalAccess(auth.user)
    ? sql``
    : auth.user.stationId
      ? sql`WHERE s.id = ${auth.user.stationId}`
      : sql`WHERE false`;
  const perStation = await db.execute(sql`
    SELECT
      s.id AS "stationId",
      s.name AS "stationName",
      COALESCE(SUM(col.amount::numeric), 0) AS "collectionsTotal",
      COUNT(col.id) AS "collectionsCount"
    FROM stations s
    LEFT JOIN collections col ON col.station_id = s.id
      AND col.occurred_at BETWEEN ${startOfDayIso}::timestamp AND ${endOfDayIso}::timestamp
    ${stationSummaryWhere}
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
