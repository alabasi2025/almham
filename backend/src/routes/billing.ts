import { Hono } from 'hono';
import { and, desc, eq, gte, lte, or, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  billingCollectionBatches,
  billingCollectionEntries,
  billingSystemAccounts,
  billingSystems,
  cashboxes,
  cashMovements,
  collections,
  employees,
  stations,
  users,
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

function dayStart(dateStr?: string | null): Date {
  const source = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const day = Number.isNaN(source.getTime()) ? new Date() : source;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
}

function dayEnd(dateStr?: string | null): Date {
  const start = dayStart(dateStr);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);
}

function collectionMoment(dateStr: string): Date {
  const date = dayStart(dateStr);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

async function ensureStationExists(stationId: string): Promise<boolean> {
  const [station] = await db
    .select({ id: stations.id })
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);
  return !!station;
}

app.get('/systems', async (c) => {
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

const billingAccountSchema = z.object({
  billingSystemId: z.string().uuid(),
  name: z.string().min(1).max(128),
  code: z.string().max(64).nullable().optional(),
  type: z.enum(['collection', 'sales', 'settlement']),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

app.get('/accounts', async (c) => {
  const auth = c.get('auth');
  const billingSystemId = c.req.query('billingSystemId');

  if (billingSystemId && !uuidQuerySchema.safeParse(billingSystemId).success) {
    return c.json({ error: 'معرّف نظام الفوترة غير صحيح' }, 400);
  }

  const conditions: SQL[] = [];
  if (billingSystemId) conditions.push(eq(billingSystemAccounts.billingSystemId, billingSystemId));
  if (!hasGlobalAccess(auth.user)) {
    conditions.push(
      auth.user.stationId
        ? or(eq(billingSystems.stationId, auth.user.stationId), isNull(billingSystems.stationId))!
        : isNull(billingSystems.stationId),
    );
  }

  const rows = await db
    .select({
      id: billingSystemAccounts.id,
      billingSystemId: billingSystemAccounts.billingSystemId,
      billingSystemName: billingSystems.name,
      stationId: billingSystems.stationId,
      stationName: stations.name,
      name: billingSystemAccounts.name,
      code: billingSystemAccounts.code,
      type: billingSystemAccounts.type,
      isActive: billingSystemAccounts.isActive,
      notes: billingSystemAccounts.notes,
      createdAt: billingSystemAccounts.createdAt,
    })
    .from(billingSystemAccounts)
    .leftJoin(billingSystems, eq(billingSystemAccounts.billingSystemId, billingSystems.id))
    .leftJoin(stations, eq(billingSystems.stationId, stations.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(billingSystems.name, billingSystemAccounts.type, billingSystemAccounts.name);

  return c.json(rows);
});

app.post('/accounts', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = billingAccountSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات حساب نظام الفوترة غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  const [billingSystem] = await db
    .select({ id: billingSystems.id, name: billingSystems.name })
    .from(billingSystems)
    .where(eq(billingSystems.id, data.billingSystemId))
    .limit(1);
  if (!billingSystem) return c.json({ error: 'نظام الفوترة غير موجود' }, 404);

  const [created] = await db
    .insert(billingSystemAccounts)
    .values({
      billingSystemId: data.billingSystemId,
      name: data.name,
      code: data.code ?? null,
      type: data.type,
      isActive: data.isActive ?? true,
      notes: data.notes ?? null,
    })
    .returning();

  await recordAudit({
    userId: auth.user.id,
    action: 'billing_account.create',
    entityType: 'billing_system_account',
    entityId: created.id,
    metadata: { billingSystemId: data.billingSystemId, type: data.type, name: data.name },
  });

  return c.json(created, 201);
});

app.put('/accounts/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!id || !uuidQuerySchema.safeParse(id).success) return c.json({ error: 'معرّف حساب الفوترة غير صحيح' }, 400);

  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = billingAccountSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات حساب نظام الفوترة غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  if (data.billingSystemId) {
    const [billingSystem] = await db
      .select({ id: billingSystems.id })
      .from(billingSystems)
      .where(eq(billingSystems.id, data.billingSystemId))
      .limit(1);
    if (!billingSystem) return c.json({ error: 'نظام الفوترة غير موجود' }, 404);
  }

  const update: Record<string, unknown> = {};
  if (data.billingSystemId !== undefined) update['billingSystemId'] = data.billingSystemId;
  if (data.name !== undefined) update['name'] = data.name;
  if (data.code !== undefined) update['code'] = data.code;
  if (data.type !== undefined) update['type'] = data.type;
  if (data.isActive !== undefined) update['isActive'] = data.isActive;
  if (data.notes !== undefined) update['notes'] = data.notes;

  const [updated] = await db
    .update(billingSystemAccounts)
    .set(update)
    .where(eq(billingSystemAccounts.id, id))
    .returning();
  if (!updated) return c.json({ error: 'حساب نظام الفوترة غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'billing_account.update',
    entityType: 'billing_system_account',
    entityId: id,
    metadata: update,
  });

  return c.json(updated);
});

app.get('/collectors', async (c) => {
  const stationId = c.req.query('stationId');
  if (!stationId) return c.json({ error: 'المحطة مطلوبة' }, 400);
  const parsed = uuidQuerySchema.safeParse(stationId);
  if (!parsed.success) return c.json({ error: 'معرّف المحطة غير صحيح' }, 400);

  const denied = requireStationAccess(c, parsed.data);
  if (denied) return denied;

  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      role: employees.role,
      stationId: employees.stationId,
      status: employees.status,
    })
    .from(employees)
    .where(and(eq(employees.stationId, parsed.data), eq(employees.status, 'active')))
    .orderBy(employees.name);

  return c.json(rows);
});

app.get('/collector-batches', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (stationId && !uuidQuerySchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صحيح' }, 400);
  }

  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, billingCollectionBatches.stationId, stationId);
  if (scope) conditions.push(scope);
  if (from) conditions.push(gte(billingCollectionBatches.collectionDate, dayStart(from)));
  if (to) conditions.push(lte(billingCollectionBatches.collectionDate, dayEnd(to)));

  const batches = await db
    .select({
      id: billingCollectionBatches.id,
      stationId: billingCollectionBatches.stationId,
      stationName: stations.name,
      billingSystemId: billingCollectionBatches.billingSystemId,
      billingSystemName: billingSystems.name,
      billingSystemColor: billingSystems.color,
      billingSystemIcon: billingSystems.icon,
      billingAccountId: billingCollectionBatches.billingAccountId,
      billingAccountName: billingSystemAccounts.name,
      billingAccountType: billingSystemAccounts.type,
      cashboxId: billingCollectionBatches.cashboxId,
      cashboxName: cashboxes.name,
      enteredByUserId: billingCollectionBatches.enteredByUserId,
      enteredByUsername: users.username,
      collectionDate: billingCollectionBatches.collectionDate,
      totalAmount: billingCollectionBatches.totalAmount,
      notes: billingCollectionBatches.notes,
      createdAt: billingCollectionBatches.createdAt,
    })
    .from(billingCollectionBatches)
    .leftJoin(stations, eq(billingCollectionBatches.stationId, stations.id))
    .leftJoin(billingSystems, eq(billingCollectionBatches.billingSystemId, billingSystems.id))
    .leftJoin(billingSystemAccounts, eq(billingCollectionBatches.billingAccountId, billingSystemAccounts.id))
    .leftJoin(cashboxes, eq(billingCollectionBatches.cashboxId, cashboxes.id))
    .leftJoin(users, eq(billingCollectionBatches.enteredByUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(billingCollectionBatches.collectionDate), desc(billingCollectionBatches.createdAt))
    .limit(120);

  const result = [];
  for (const batch of batches) {
    const entries = await db
      .select({
        id: billingCollectionEntries.id,
        batchId: billingCollectionEntries.batchId,
        collectorEmployeeId: billingCollectionEntries.collectorEmployeeId,
        collectorName: employees.name,
        collectionId: billingCollectionEntries.collectionId,
        amount: billingCollectionEntries.amount,
        notes: billingCollectionEntries.notes,
        createdAt: billingCollectionEntries.createdAt,
      })
      .from(billingCollectionEntries)
      .leftJoin(employees, eq(billingCollectionEntries.collectorEmployeeId, employees.id))
      .where(eq(billingCollectionEntries.batchId, batch.id))
      .orderBy(employees.name);
    result.push({ ...batch, entries });
  }

  return c.json(result);
});

const collectorBatchSchema = z.object({
  stationId: z.string().uuid(),
  billingSystemId: z.string().uuid(),
  billingAccountId: z.string().uuid(),
  cashboxId: z.string().uuid(),
  collectionDate: z.string().min(1),
  notes: z.string().nullable().optional(),
  entries: z.array(
    z.object({
      collectorEmployeeId: z.string().uuid(),
      amount: z.union([z.string(), z.number()]),
      notes: z.string().nullable().optional(),
    }),
  ).min(1),
});

type ValidCollectorEntry = {
  collector: {
    id: string;
    name: string;
    stationId: string | null;
    status: 'active' | 'inactive';
  };
  amount: number;
  notes: string | null;
};

app.post('/collector-batches', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = collectorBatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات التحصيل غير صحيحة', details: parsed.error.issues }, 400);

  const data = parsed.data;
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;

  if (!(await ensureStationExists(data.stationId))) {
    return c.json({ error: 'المحطة غير موجودة' }, 404);
  }

  const [billingSystem] = await db
    .select({
      id: billingSystems.id,
      name: billingSystems.name,
      stationId: billingSystems.stationId,
      isActive: billingSystems.isActive,
    })
    .from(billingSystems)
    .where(eq(billingSystems.id, data.billingSystemId))
    .limit(1);
  if (!billingSystem || !billingSystem.isActive) {
    return c.json({ error: 'حساب نظام الفوترة غير موجود أو غير نشط' }, 404);
  }
  if (billingSystem.stationId && billingSystem.stationId !== data.stationId) {
    return c.json({ error: 'حساب نظام الفوترة لا يتبع هذه المحطة' }, 400);
  }

  const [billingAccount] = await db
    .select({
      id: billingSystemAccounts.id,
      billingSystemId: billingSystemAccounts.billingSystemId,
      name: billingSystemAccounts.name,
      type: billingSystemAccounts.type,
      isActive: billingSystemAccounts.isActive,
    })
    .from(billingSystemAccounts)
    .where(eq(billingSystemAccounts.id, data.billingAccountId))
    .limit(1);
  if (!billingAccount || !billingAccount.isActive) {
    return c.json({ error: 'حساب الفوترة غير موجود أو غير نشط' }, 404);
  }
  if (billingAccount.billingSystemId !== data.billingSystemId) {
    return c.json({ error: 'حساب الفوترة لا يتبع النظام المحدد' }, 400);
  }
  if (billingAccount.type !== 'collection') {
    return c.json({ error: 'تسجيل تحصيل المتحصلين يجب أن يكون على حساب التحصيل فقط' }, 400);
  }

  const [cashbox] = await db
    .select({
      id: cashboxes.id,
      name: cashboxes.name,
      type: cashboxes.type,
      stationId: cashboxes.stationId,
      isActive: cashboxes.isActive,
    })
    .from(cashboxes)
    .where(eq(cashboxes.id, data.cashboxId))
    .limit(1);
  if (!cashbox || !cashbox.isActive) return c.json({ error: 'صندوق الاستلام غير موجود أو غير نشط' }, 404);
  if (cashbox.type !== 'station' || cashbox.stationId !== data.stationId) {
    return c.json({ error: 'صندوق الاستلام يجب أن يكون صندوق نفس المحطة' }, 400);
  }

  const seenCollectors = new Set<string>();
  const entries: ValidCollectorEntry[] = [];
  for (const entry of data.entries) {
    if (seenCollectors.has(entry.collectorEmployeeId)) {
      return c.json({ error: 'لا تكرر نفس المتحصل في نفس الدفعة' }, 400);
    }
    seenCollectors.add(entry.collectorEmployeeId);

    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: 'كل مبلغ يجب أن يكون أكبر من صفر' }, 400);
    }

    const [collector] = await db
      .select({
        id: employees.id,
        name: employees.name,
        stationId: employees.stationId,
        status: employees.status,
      })
      .from(employees)
      .where(eq(employees.id, entry.collectorEmployeeId))
      .limit(1);
    if (!collector) return c.json({ error: 'أحد المتحصلين غير موجود' }, 404);
    if (collector.stationId !== data.stationId || collector.status !== 'active') {
      return c.json({ error: `المتحصل ${collector.name} لا يتبع هذه المحطة أو غير نشط` }, 400);
    }

    entries.push({
      collector,
      amount,
      notes: entry.notes ?? null,
    });
  }

  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const occurredAt = collectionMoment(data.collectionDate);

  const created = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(billingCollectionBatches)
      .values({
        stationId: data.stationId,
        billingSystemId: data.billingSystemId,
        billingAccountId: data.billingAccountId,
        cashboxId: data.cashboxId,
        enteredByUserId: auth.user.id,
        collectionDate: occurredAt,
        totalAmount: String(totalAmount),
        notes: data.notes ?? null,
      })
      .returning();

    const createdEntries = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const note = entry.notes || data.notes || `تحصيل ${entry.collector.name} من ${billingSystem.name}`;
      const [collection] = await tx
        .insert(collections)
        .values({
          stationId: data.stationId,
          cashboxId: data.cashboxId,
          billingSystemId: data.billingSystemId,
          billingAccountId: data.billingAccountId,
          collectorUserId: auth.user.id,
          collectorEmployeeId: entry.collector.id,
          subscriberName: entry.collector.name,
          amount: String(entry.amount),
          currency: 'YER',
          paymentMethod: 'cash',
          receiptCode: `${batch.id.slice(0, 8)}-${index + 1}`,
          notes: note,
          occurredAt,
        })
        .returning();

      await tx.insert(cashMovements).values({
        cashboxId: data.cashboxId,
        direction: 'in',
        amount: String(entry.amount),
        currency: 'YER',
        refType: 'collection',
        refId: collection.id,
        userId: auth.user.id,
        occurredAt,
        notes: note,
      });

      const [createdEntry] = await tx
        .insert(billingCollectionEntries)
        .values({
          batchId: batch.id,
          collectorEmployeeId: entry.collector.id,
          collectionId: collection.id,
          amount: String(entry.amount),
          notes: entry.notes,
        })
        .returning();

      createdEntries.push({
        ...createdEntry,
        collectorName: entry.collector.name,
        collectionId: collection.id,
      });
    }

    return { ...batch, entries: createdEntries };
  });

  await recordAudit({
    userId: auth.user.id,
    action: 'billing_collector_batch.create',
    entityType: 'billing_collection_batch',
    entityId: created.id,
    metadata: {
      stationId: data.stationId,
      billingSystemId: data.billingSystemId,
      billingAccountId: data.billingAccountId,
      cashboxId: data.cashboxId,
      totalAmount,
      entriesCount: entries.length,
    },
  });

  return c.json(created, 201);
});

export default app;
