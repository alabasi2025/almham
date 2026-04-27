import { Hono, type Context } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  fuelSuppliers,
  supplierSites,
  tankers,
  tanks,
  pumps,
  pumpChannels,
  generators,
  fuelReceipts,
  fuelTransfers,
  generatorConsumption,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  hasGlobalAccess,
  requireGlobalAccess,
  requireStationAccess,
  stationScopeCondition,
} from '../lib/access-control.js';
import { recordAudit } from '../lib/audit.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const uuidSchema = z.string().uuid();
const optionalText = (max = 2000) =>
  z.preprocess((value) => (value === '' ? null : value), z.string().trim().max(max).nullable().optional());
const optionalUuid = z.preprocess((value) => (value === '' ? null : value), z.string().uuid().nullable().optional());
const optionalNumber = z.preprocess(
  (value) => (value === '' ? null : value),
  z.coerce.number().nonnegative().nullable().optional(),
);
const optionalDate = z.string().min(1).optional();

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(255),
  phone: optionalText(20),
  notes: optionalText(),
});

const supplierSiteSchema = z.object({
  supplierId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  location: optionalText(500),
  latitude: z.preprocess(
    (value) => (value === '' ? null : value),
    z.coerce.number().min(-90).max(90).nullable().optional(),
  ),
  longitude: z.preprocess(
    (value) => (value === '' ? null : value),
    z.coerce.number().min(-180).max(180).nullable().optional(),
  ),
});

const tankerSchema = z.object({
  plate: z.string().trim().min(1).max(64),
  driverName: optionalText(255),
  compartments: z.array(z.coerce.number().int().positive()).max(20).optional(),
  notes: optionalText(),
});

const tankSchema = z.object({
  stationId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  role: z.enum(['receiving', 'main', 'pre_pump', 'generator']),
  material: z.enum(['plastic', 'steel', 'rocket', 'other']).optional(),
  capacityL: z.coerce.number().int().min(0).optional(),
  notes: optionalText(),
});

const pumpSchema = z.object({
  stationId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  inletsCount: z.coerce.number().int().min(1).max(20).optional(),
  outletsCount: z.coerce.number().int().min(1).max(20).optional(),
  metersCount: z.coerce.number().int().min(1).max(20).optional(),
  notes: optionalText(),
});

const pumpChannelSchema = z.object({
  pumpId: z.string().uuid(),
  channelIndex: z.coerce.number().int().min(1).max(100),
  sourceTankId: optionalUuid,
  destinationTankId: optionalUuid,
  meterLabel: optionalText(100),
});

const generatorSchema = z.object({
  stationId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  model: optionalText(255),
  capacityKw: z.coerce.number().int().min(0).optional(),
  isBackup: z.boolean().optional(),
  rocketTankId: optionalUuid,
  notes: optionalText(),
});

const receiptSchema = z.object({
  stationId: z.string().uuid(),
  supplierId: optionalUuid,
  supplierSiteId: optionalUuid,
  tankerId: optionalUuid,
  receiverEmployeeId: optionalUuid,
  receivingTankId: optionalUuid,
  supplierRepName: optionalText(255),
  meterBefore: optionalNumber,
  meterAfter: optionalNumber,
  compartmentsFilled: z.array(z.coerce.number().int().min(0)).max(20).nullable().optional(),
  totalLiters: z.coerce.number().int().positive(),
  voucherNumber: optionalText(100),
  voucherOriginalHolder: optionalText(255),
  invoicePhotoUrl: optionalText(),
  meterBeforePhotoUrl: optionalText(),
  meterAfterPhotoUrl: optionalText(),
  notes: optionalText(),
  receivedAt: optionalDate,
});

const transferSchema = z.object({
  stationId: z.string().uuid(),
  sourceTankId: z.string().uuid(),
  destinationTankId: z.string().uuid(),
  pumpChannelId: optionalUuid,
  meterReadingBefore: optionalNumber,
  meterReadingAfter: optionalNumber,
  liters: z.coerce.number().int().positive(),
  operatorEmployeeId: optionalUuid,
  notes: optionalText(),
  transferredAt: optionalDate,
});

const consumptionSchema = z.object({
  generatorId: z.string().uuid(),
  liters: z.coerce.number().int().positive(),
  hoursRun: optionalNumber,
  operatorEmployeeId: optionalUuid,
  notes: optionalText(),
  readingDate: optionalDate,
});

function parseDateInput(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function getTankStationId(id: string): Promise<string | null> {
  const [tank] = await db.select({ stationId: tanks.stationId }).from(tanks).where(eq(tanks.id, id)).limit(1);
  return tank?.stationId ?? null;
}

async function getPumpStationId(id: string): Promise<string | null> {
  const [pump] = await db.select({ stationId: pumps.stationId }).from(pumps).where(eq(pumps.id, id)).limit(1);
  return pump?.stationId ?? null;
}

async function getPumpChannelStationId(id: string): Promise<string | null> {
  const [channel] = await db
    .select({ stationId: pumps.stationId })
    .from(pumpChannels)
    .innerJoin(pumps, eq(pumpChannels.pumpId, pumps.id))
    .where(eq(pumpChannels.id, id))
    .limit(1);
  return channel?.stationId ?? null;
}

async function getGeneratorStationId(id: string): Promise<string | null> {
  const [generator] = await db
    .select({ stationId: generators.stationId })
    .from(generators)
    .where(eq(generators.id, id))
    .limit(1);
  return generator?.stationId ?? null;
}

async function requirePumpAccess(c: Context<HonoEnv>, pumpId: string): Promise<Response | null> {
  const stationId = await getPumpStationId(pumpId);
  if (!stationId) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  return requireStationAccess(c, stationId);
}

async function ensureTankInStation(tankId: string | null | undefined, stationId: string): Promise<boolean> {
  if (!tankId) return true;
  return (await getTankStationId(tankId)) === stationId;
}

async function auditFuel(
  c: Context<HonoEnv>,
  action: string,
  entityType: string,
  entityId: string | null | undefined,
  metadata?: Record<string, unknown>,
) {
  await recordAudit({
    userId: c.get('auth').user.id,
    action,
    entityType,
    entityId: entityId ?? null,
    metadata: metadata ?? null,
  });
}

// ---------- Suppliers ----------
app.get('/suppliers', async (c) => {
  const rows = await db.select().from(fuelSuppliers).orderBy(fuelSuppliers.createdAt);
  return c.json(rows);
});

app.post('/suppliers', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const body = await c.req.json().catch(() => null);
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المورد غير صحيحة' }, 400);
  const data = parsed.data;

  const [row] = await db.insert(fuelSuppliers).values({
    name: data.name,
    phone: data.phone ?? null,
    notes: data.notes ?? null,
  }).returning();
  await auditFuel(c, 'fuel_supplier.create', 'fuel_supplier', row.id, { name: row.name });
  return c.json(row, 201);
});

app.put('/suppliers/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = supplierSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المورد غير صحيحة' }, 400);

  const [row] = await db.update(fuelSuppliers).set(parsed.data).where(eq(fuelSuppliers.id, id)).returning();
  if (!row) return c.json({ error: 'المورد غير موجود' }, 404);
  await auditFuel(c, 'fuel_supplier.update', 'fuel_supplier', id, { changedFields: Object.keys(parsed.data) });
  return c.json(row);
});

app.delete('/suppliers/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [row] = await db.delete(fuelSuppliers).where(eq(fuelSuppliers.id, id)).returning();
  if (!row) return c.json({ error: 'المورد غير موجود' }, 404);
  await auditFuel(c, 'fuel_supplier.delete', 'fuel_supplier', id, { name: row.name });
  return c.json({ success: true });
});

// ---------- Supplier Sites ----------
app.get('/supplier-sites', async (c) => {
  const supplierId = c.req.query('supplierId');
  if (supplierId && !uuidSchema.safeParse(supplierId).success) {
    return c.json({ error: 'معرّف المورد غير صالح' }, 400);
  }
  const rows = supplierId
    ? await db.select().from(supplierSites).where(eq(supplierSites.supplierId, supplierId))
    : await db.select().from(supplierSites);
  return c.json(rows);
});

app.post('/supplier-sites', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const body = await c.req.json().catch(() => null);
  const parsed = supplierSiteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات موقع المورد غير صحيحة' }, 400);
  const data = parsed.data;

  const [row] = await db.insert(supplierSites).values({
    supplierId: data.supplierId,
    name: data.name,
    location: data.location ?? null,
    latitude: data.latitude != null ? String(data.latitude) : null,
    longitude: data.longitude != null ? String(data.longitude) : null,
  }).returning();
  await auditFuel(c, 'supplier_site.create', 'supplier_site', row.id, { supplierId: row.supplierId, name: row.name });
  return c.json(row, 201);
});

app.put('/supplier-sites/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = supplierSiteSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات موقع المورد غير صحيحة' }, 400);
  const data = parsed.data;
  const update: Record<string, unknown> = { ...data };
  if (data.latitude !== undefined) update['latitude'] = data.latitude != null ? String(data.latitude) : null;
  if (data.longitude !== undefined) update['longitude'] = data.longitude != null ? String(data.longitude) : null;
  const [row] = await db.update(supplierSites).set(update).where(eq(supplierSites.id, id)).returning();
  if (!row) return c.json({ error: 'الموقع غير موجود' }, 404);
  await auditFuel(c, 'supplier_site.update', 'supplier_site', id, {
    changedFields: Object.keys(update),
    locationChanged: update['latitude'] !== undefined || update['longitude'] !== undefined,
  });
  return c.json(row);
});

app.delete('/supplier-sites/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [row] = await db.delete(supplierSites).where(eq(supplierSites.id, id)).returning();
  if (!row) return c.json({ error: 'الموقع غير موجود' }, 404);
  await auditFuel(c, 'supplier_site.delete', 'supplier_site', id, { supplierId: row.supplierId, name: row.name });
  return c.json({ success: true });
});

// ---------- Tankers ----------
app.get('/tankers', async (c) => {
  const rows = await db.select().from(tankers).orderBy(tankers.createdAt);
  return c.json(rows);
});

app.post('/tankers', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const body = await c.req.json().catch(() => null);
  const parsed = tankerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الوايت غير صحيحة' }, 400);
  const data = parsed.data;

  const [row] = await db.insert(tankers).values({
    plate: data.plate,
    driverName: data.driverName ?? null,
    compartments: data.compartments ?? [],
    notes: data.notes ?? null,
  }).returning();
  await auditFuel(c, 'tanker.create', 'tanker', row.id, { plate: row.plate });
  return c.json(row, 201);
});

app.put('/tankers/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = tankerSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الوايت غير صحيحة' }, 400);
  const [row] = await db.update(tankers).set(parsed.data).where(eq(tankers.id, id)).returning();
  if (!row) return c.json({ error: 'الوايت غير موجود' }, 404);
  await auditFuel(c, 'tanker.update', 'tanker', id, { changedFields: Object.keys(parsed.data) });
  return c.json(row);
});

app.delete('/tankers/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [row] = await db.delete(tankers).where(eq(tankers.id, id)).returning();
  if (!row) return c.json({ error: 'الوايت غير موجود' }, 404);
  await auditFuel(c, 'tanker.delete', 'tanker', id, { plate: row.plate });
  return c.json({ success: true });
});

// ---------- Tanks ----------
app.get('/tanks', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  if (stationId && !uuidSchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  }
  const scope = stationScopeCondition(auth, tanks.stationId, stationId);
  const rows = stationId
    ? await db.select().from(tanks).where(scope).orderBy(tanks.createdAt)
    : await db.select().from(tanks).where(scope).orderBy(tanks.createdAt);
  return c.json(rows);
});

app.post('/tanks', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = tankSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الخزان غير صحيحة' }, 400);
  const data = parsed.data;
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;

  const [row] = await db.insert(tanks).values({
    stationId: data.stationId,
    name: data.name,
    role: data.role,
    material: data.material ?? 'other',
    capacityL: data.capacityL ?? 0,
    notes: data.notes ?? null,
  }).returning();
  await auditFuel(c, 'tank.create', 'tank', row.id, { stationId: row.stationId, name: row.name, role: row.role });
  return c.json(row, 201);
});

app.put('/tanks/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db.select({ stationId: tanks.stationId }).from(tanks).where(eq(tanks.id, id)).limit(1);
  if (!current) return c.json({ error: 'الخزان غير موجود' }, 404);
  const currentDenied = requireStationAccess(c, current.stationId);
  if (currentDenied) return currentDenied;

  const body = await c.req.json().catch(() => null);
  const parsed = tankSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الخزان غير صحيحة' }, 400);
  if (parsed.data.stationId) {
    const newStationDenied = requireStationAccess(c, parsed.data.stationId);
    if (newStationDenied) return newStationDenied;
  }
  const [row] = await db.update(tanks).set(parsed.data).where(eq(tanks.id, id)).returning();
  if (!row) return c.json({ error: 'الخزان غير موجود' }, 404);
  await auditFuel(c, 'tank.update', 'tank', id, { stationId: row.stationId, changedFields: Object.keys(parsed.data) });
  return c.json(row);
});

app.delete('/tanks/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db.select({ stationId: tanks.stationId }).from(tanks).where(eq(tanks.id, id)).limit(1);
  if (!current) return c.json({ error: 'الخزان غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(tanks).where(eq(tanks.id, id)).returning();
  if (!row) return c.json({ error: 'الخزان غير موجود' }, 404);
  await auditFuel(c, 'tank.delete', 'tank', id, { stationId: row.stationId, name: row.name });
  return c.json({ success: true });
});

// ---------- Pumps ----------
app.get('/pumps', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  if (stationId && !uuidSchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  }
  const scope = stationScopeCondition(auth, pumps.stationId, stationId);
  const rows = stationId
    ? await db.select().from(pumps).where(scope).orderBy(pumps.createdAt)
    : await db.select().from(pumps).where(scope).orderBy(pumps.createdAt);
  return c.json(rows);
});

app.post('/pumps', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = pumpSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الطرمبة غير صحيحة' }, 400);
  const data = parsed.data;
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;

  const [row] = await db.insert(pumps).values({
    stationId: data.stationId,
    name: data.name,
    inletsCount: data.inletsCount ?? 1,
    outletsCount: data.outletsCount ?? 1,
    metersCount: data.metersCount ?? 1,
    notes: data.notes ?? null,
  }).returning();
  await auditFuel(c, 'pump.create', 'pump', row.id, { stationId: row.stationId, name: row.name });
  return c.json(row, 201);
});

app.put('/pumps/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db.select({ stationId: pumps.stationId }).from(pumps).where(eq(pumps.id, id)).limit(1);
  if (!current) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  const currentDenied = requireStationAccess(c, current.stationId);
  if (currentDenied) return currentDenied;

  const body = await c.req.json().catch(() => null);
  const parsed = pumpSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الطرمبة غير صحيحة' }, 400);
  if (parsed.data.stationId) {
    const newStationDenied = requireStationAccess(c, parsed.data.stationId);
    if (newStationDenied) return newStationDenied;
  }
  const [row] = await db.update(pumps).set(parsed.data).where(eq(pumps.id, id)).returning();
  if (!row) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  await auditFuel(c, 'pump.update', 'pump', id, { stationId: row.stationId, changedFields: Object.keys(parsed.data) });
  return c.json(row);
});

app.delete('/pumps/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db.select({ stationId: pumps.stationId }).from(pumps).where(eq(pumps.id, id)).limit(1);
  if (!current) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(pumps).where(eq(pumps.id, id)).returning();
  if (!row) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  await auditFuel(c, 'pump.delete', 'pump', id, { stationId: row.stationId, name: row.name });
  return c.json({ success: true });
});

// ---------- Pump Channels ----------
app.get('/pump-channels', async (c) => {
  const auth = c.get('auth');
  const pumpId = c.req.query('pumpId');
  if (pumpId && !uuidSchema.safeParse(pumpId).success) {
    return c.json({ error: 'معرّف الطرمبة غير صالح' }, 400);
  }
  if (pumpId) {
    const denied = await requirePumpAccess(c, pumpId);
    if (denied) return denied;
    const rows = await db
      .select()
      .from(pumpChannels)
      .where(eq(pumpChannels.pumpId, pumpId))
      .orderBy(pumpChannels.channelIndex);
    return c.json(rows);
  }

  const rows = hasGlobalAccess(auth.user)
    ? await db.select().from(pumpChannels).orderBy(pumpChannels.channelIndex)
    : auth.user.stationId
      ? await db
          .select({
            id: pumpChannels.id,
            pumpId: pumpChannels.pumpId,
            channelIndex: pumpChannels.channelIndex,
            sourceTankId: pumpChannels.sourceTankId,
            destinationTankId: pumpChannels.destinationTankId,
            meterLabel: pumpChannels.meterLabel,
            createdAt: pumpChannels.createdAt,
          })
          .from(pumpChannels)
          .innerJoin(pumps, eq(pumpChannels.pumpId, pumps.id))
          .where(eq(pumps.stationId, auth.user.stationId))
          .orderBy(pumpChannels.channelIndex)
      : [];
  return c.json(rows);
});

app.post('/pump-channels', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = pumpChannelSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات قناة الطرمبة غير صحيحة' }, 400);
  const data = parsed.data;
  const stationId = await getPumpStationId(data.pumpId);
  if (!stationId) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  const denied = requireStationAccess(c, stationId);
  if (denied) return denied;
  if (!(await ensureTankInStation(data.sourceTankId, stationId)) || !(await ensureTankInStation(data.destinationTankId, stationId))) {
    return c.json({ error: 'خزانات القناة يجب أن تكون من نفس محطة الطرمبة' }, 400);
  }

  const [row] = await db.insert(pumpChannels).values({
    pumpId: data.pumpId,
    channelIndex: data.channelIndex,
    sourceTankId: data.sourceTankId ?? null,
    destinationTankId: data.destinationTankId ?? null,
    meterLabel: data.meterLabel ?? null,
  }).returning();
  await auditFuel(c, 'pump_channel.create', 'pump_channel', row.id, {
    stationId,
    pumpId: row.pumpId,
    channelIndex: row.channelIndex,
  });
  return c.json(row, 201);
});

app.put('/pump-channels/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({
      pumpId: pumpChannels.pumpId,
      sourceTankId: pumpChannels.sourceTankId,
      destinationTankId: pumpChannels.destinationTankId,
      stationId: pumps.stationId,
    })
    .from(pumpChannels)
    .innerJoin(pumps, eq(pumpChannels.pumpId, pumps.id))
    .where(eq(pumpChannels.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'القناة غير موجودة' }, 404);
  const currentDenied = requireStationAccess(c, current.stationId);
  if (currentDenied) return currentDenied;

  const body = await c.req.json().catch(() => null);
  const parsed = pumpChannelSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات قناة الطرمبة غير صحيحة' }, 400);
  const targetPumpId = parsed.data.pumpId ?? current.pumpId;
  const targetStationId = await getPumpStationId(targetPumpId);
  if (!targetStationId) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  const targetDenied = requireStationAccess(c, targetStationId);
  if (targetDenied) return targetDenied;
  const targetSourceTankId = parsed.data.sourceTankId !== undefined ? parsed.data.sourceTankId : current.sourceTankId;
  const targetDestinationTankId =
    parsed.data.destinationTankId !== undefined ? parsed.data.destinationTankId : current.destinationTankId;
  if (!(await ensureTankInStation(targetSourceTankId, targetStationId)) || !(await ensureTankInStation(targetDestinationTankId, targetStationId))) {
    return c.json({ error: 'خزانات القناة يجب أن تكون من نفس محطة الطرمبة' }, 400);
  }
  const [row] = await db.update(pumpChannels).set(parsed.data).where(eq(pumpChannels.id, id)).returning();
  if (!row) return c.json({ error: 'القناة غير موجودة' }, 404);
  await auditFuel(c, 'pump_channel.update', 'pump_channel', id, {
    stationId: targetStationId,
    pumpId: row.pumpId,
    changedFields: Object.keys(parsed.data),
  });
  return c.json(row);
});

app.delete('/pump-channels/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({ stationId: pumps.stationId })
    .from(pumpChannels)
    .innerJoin(pumps, eq(pumpChannels.pumpId, pumps.id))
    .where(eq(pumpChannels.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'القناة غير موجودة' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(pumpChannels).where(eq(pumpChannels.id, id)).returning();
  if (!row) return c.json({ error: 'القناة غير موجودة' }, 404);
  await auditFuel(c, 'pump_channel.delete', 'pump_channel', id, {
    stationId: current.stationId,
    pumpId: row.pumpId,
    channelIndex: row.channelIndex,
  });
  return c.json({ success: true });
});

// ---------- Generators ----------
app.get('/generators', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  if (stationId && !uuidSchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  }
  const scope = stationScopeCondition(auth, generators.stationId, stationId);
  const rows = stationId
    ? await db.select().from(generators).where(scope).orderBy(generators.createdAt)
    : await db.select().from(generators).where(scope).orderBy(generators.createdAt);
  return c.json(rows);
});

app.post('/generators', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = generatorSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المولد غير صحيحة' }, 400);
  const data = parsed.data;
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;
  if (!(await ensureTankInStation(data.rocketTankId, data.stationId))) {
    return c.json({ error: 'خزان المولد يجب أن يكون من نفس المحطة' }, 400);
  }

  const [row] = await db.insert(generators).values({
    stationId: data.stationId,
    name: data.name,
    model: data.model ?? null,
    capacityKw: data.capacityKw ?? 0,
    isBackup: data.isBackup ?? false,
    rocketTankId: data.rocketTankId ?? null,
    notes: data.notes ?? null,
  }).returning();
  await auditFuel(c, 'generator.create', 'generator', row.id, {
    stationId: row.stationId,
    name: row.name,
    capacityKw: row.capacityKw,
  });
  return c.json(row, 201);
});

app.put('/generators/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({ stationId: generators.stationId, rocketTankId: generators.rocketTankId })
    .from(generators)
    .where(eq(generators.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'المولد غير موجود' }, 404);
  const currentDenied = requireStationAccess(c, current.stationId);
  if (currentDenied) return currentDenied;

  const body = await c.req.json().catch(() => null);
  const parsed = generatorSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المولد غير صحيحة' }, 400);
  const targetStationId = parsed.data.stationId ?? current.stationId;
  const targetRocketTankId = parsed.data.rocketTankId !== undefined ? parsed.data.rocketTankId : current.rocketTankId;
  const targetDenied = requireStationAccess(c, targetStationId);
  if (targetDenied) return targetDenied;
  if (!(await ensureTankInStation(targetRocketTankId, targetStationId))) {
    return c.json({ error: 'خزان المولد يجب أن يكون من نفس المحطة' }, 400);
  }
  const [row] = await db.update(generators).set(parsed.data).where(eq(generators.id, id)).returning();
  if (!row) return c.json({ error: 'المولد غير موجود' }, 404);
  await auditFuel(c, 'generator.update', 'generator', id, {
    stationId: row.stationId,
    changedFields: Object.keys(parsed.data),
  });
  return c.json(row);
});

app.delete('/generators/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({ stationId: generators.stationId })
    .from(generators)
    .where(eq(generators.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'المولد غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(generators).where(eq(generators.id, id)).returning();
  if (!row) return c.json({ error: 'المولد غير موجود' }, 404);
  await auditFuel(c, 'generator.delete', 'generator', id, { stationId: row.stationId, name: row.name });
  return c.json({ success: true });
});

// ---------- Fuel Receipts ----------
app.get('/receipts', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  if (stationId && !uuidSchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  }
  const scope = stationScopeCondition(auth, fuelReceipts.stationId, stationId);
  const rows = stationId
    ? await db.select().from(fuelReceipts).where(scope).orderBy(fuelReceipts.receivedAt)
    : await db.select().from(fuelReceipts).where(scope).orderBy(fuelReceipts.receivedAt);
  return c.json(rows);
});

app.post('/receipts', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = receiptSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات سند الديزل غير صحيحة' }, 400);
  const data = parsed.data;
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;
  if (!(await ensureTankInStation(data.receivingTankId, data.stationId))) {
    return c.json({ error: 'خزان الاستلام يجب أن يكون من نفس المحطة' }, 400);
  }

  const [row] = await db.insert(fuelReceipts).values({
    stationId: data.stationId,
    supplierId: data.supplierId ?? null,
    supplierSiteId: data.supplierSiteId ?? null,
    tankerId: data.tankerId ?? null,
    receiverEmployeeId: data.receiverEmployeeId ?? null,
    receivingTankId: data.receivingTankId ?? null,
    supplierRepName: data.supplierRepName ?? null,
    meterBefore: data.meterBefore != null ? String(data.meterBefore) : null,
    meterAfter: data.meterAfter != null ? String(data.meterAfter) : null,
    compartmentsFilled: data.compartmentsFilled ?? null,
    totalLiters: data.totalLiters,
    voucherNumber: data.voucherNumber ?? null,
    voucherOriginalHolder: data.voucherOriginalHolder ?? null,
    invoicePhotoUrl: data.invoicePhotoUrl ?? null,
    meterBeforePhotoUrl: data.meterBeforePhotoUrl ?? null,
    meterAfterPhotoUrl: data.meterAfterPhotoUrl ?? null,
    notes: data.notes ?? null,
    receivedAt: parseDateInput(data.receivedAt),
  }).returning();
  await auditFuel(c, 'fuel_receipt.create', 'fuel_receipt', row.id, {
    stationId: row.stationId,
    totalLiters: row.totalLiters,
    supplierId: row.supplierId,
    receivingTankId: row.receivingTankId,
  });
  return c.json(row, 201);
});

app.delete('/receipts/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({ stationId: fuelReceipts.stationId })
    .from(fuelReceipts)
    .where(eq(fuelReceipts.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'السند غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(fuelReceipts).where(eq(fuelReceipts.id, id)).returning();
  if (!row) return c.json({ error: 'السند غير موجود' }, 404);
  await auditFuel(c, 'fuel_receipt.delete', 'fuel_receipt', id, {
    stationId: row.stationId,
    totalLiters: row.totalLiters,
    receivingTankId: row.receivingTankId,
  });
  return c.json({ success: true });
});

// ---------- Fuel Transfers ----------
app.get('/transfers', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  if (stationId && !uuidSchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  }
  const scope = stationScopeCondition(auth, fuelTransfers.stationId, stationId);
  const rows = stationId
    ? await db.select().from(fuelTransfers).where(scope).orderBy(fuelTransfers.transferredAt)
    : await db.select().from(fuelTransfers).where(scope).orderBy(fuelTransfers.transferredAt);
  return c.json(rows);
});

app.post('/transfers', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات تحويل الديزل غير صحيحة' }, 400);
  const data = parsed.data;
  if (data.sourceTankId === data.destinationTankId) {
    return c.json({ error: 'لا يمكن التحويل إلى نفس الخزان' }, 400);
  }
  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;
  if (!(await ensureTankInStation(data.sourceTankId, data.stationId)) || !(await ensureTankInStation(data.destinationTankId, data.stationId))) {
    return c.json({ error: 'خزانات التحويل يجب أن تكون من نفس المحطة' }, 400);
  }
  if (data.pumpChannelId) {
    const channelStationId = await getPumpChannelStationId(data.pumpChannelId);
    if (!channelStationId) return c.json({ error: 'قناة الطرمبة غير موجودة' }, 404);
    if (channelStationId !== data.stationId) {
      return c.json({ error: 'قناة الطرمبة يجب أن تكون من نفس المحطة' }, 400);
    }
  }

  const [row] = await db.insert(fuelTransfers).values({
    stationId: data.stationId,
    sourceTankId: data.sourceTankId,
    destinationTankId: data.destinationTankId,
    pumpChannelId: data.pumpChannelId ?? null,
    meterReadingBefore: data.meterReadingBefore != null ? String(data.meterReadingBefore) : null,
    meterReadingAfter: data.meterReadingAfter != null ? String(data.meterReadingAfter) : null,
    liters: data.liters,
    operatorEmployeeId: data.operatorEmployeeId ?? null,
    notes: data.notes ?? null,
    transferredAt: parseDateInput(data.transferredAt),
  }).returning();
  await auditFuel(c, 'fuel_transfer.create', 'fuel_transfer', row.id, {
    stationId: row.stationId,
    sourceTankId: row.sourceTankId,
    destinationTankId: row.destinationTankId,
    liters: row.liters,
  });
  return c.json(row, 201);
});

app.delete('/transfers/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({ stationId: fuelTransfers.stationId })
    .from(fuelTransfers)
    .where(eq(fuelTransfers.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'التحويل غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(fuelTransfers).where(eq(fuelTransfers.id, id)).returning();
  if (!row) return c.json({ error: 'التحويل غير موجود' }, 404);
  await auditFuel(c, 'fuel_transfer.delete', 'fuel_transfer', id, {
    stationId: row.stationId,
    sourceTankId: row.sourceTankId,
    destinationTankId: row.destinationTankId,
    liters: row.liters,
  });
  return c.json({ success: true });
});

// ---------- Generator Consumption ----------
app.get('/consumption', async (c) => {
  const auth = c.get('auth');
  const generatorId = c.req.query('generatorId');
  const stationId = c.req.query('stationId');
  if (generatorId && !uuidSchema.safeParse(generatorId).success) {
    return c.json({ error: 'معرّف المولد غير صالح' }, 400);
  }
  if (stationId && !uuidSchema.safeParse(stationId).success) {
    return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  }
  if (generatorId) {
    const generatorStationId = await getGeneratorStationId(generatorId);
    if (!generatorStationId) return c.json({ error: 'المولد غير موجود' }, 404);
    const denied = requireStationAccess(c, generatorStationId);
    if (denied) return denied;
    const rows = await db.select().from(generatorConsumption).where(eq(generatorConsumption.generatorId, generatorId)).orderBy(generatorConsumption.readingDate);
    return c.json(rows);
  }
  if (stationId) {
    const denied = requireStationAccess(c, stationId);
    if (denied) return denied;
    const rows = await db
      .select({
        id: generatorConsumption.id,
        generatorId: generatorConsumption.generatorId,
        liters: generatorConsumption.liters,
        hoursRun: generatorConsumption.hoursRun,
        operatorEmployeeId: generatorConsumption.operatorEmployeeId,
        readingDate: generatorConsumption.readingDate,
        notes: generatorConsumption.notes,
        createdAt: generatorConsumption.createdAt,
      })
      .from(generatorConsumption)
      .innerJoin(generators, eq(generatorConsumption.generatorId, generators.id))
      .where(eq(generators.stationId, stationId))
      .orderBy(generatorConsumption.readingDate);
    return c.json(rows);
  }
  if (!hasGlobalAccess(auth.user)) {
    if (!auth.user.stationId) return c.json([]);
    const rows = await db
      .select({
        id: generatorConsumption.id,
        generatorId: generatorConsumption.generatorId,
        liters: generatorConsumption.liters,
        hoursRun: generatorConsumption.hoursRun,
        operatorEmployeeId: generatorConsumption.operatorEmployeeId,
        readingDate: generatorConsumption.readingDate,
        notes: generatorConsumption.notes,
        createdAt: generatorConsumption.createdAt,
      })
      .from(generatorConsumption)
      .innerJoin(generators, eq(generatorConsumption.generatorId, generators.id))
      .where(eq(generators.stationId, auth.user.stationId))
      .orderBy(generatorConsumption.readingDate);
    return c.json(rows);
  }
  const rows = await db.select().from(generatorConsumption).orderBy(generatorConsumption.readingDate);
  return c.json(rows);
});

app.post('/consumption', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = consumptionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات استهلاك المولد غير صحيحة' }, 400);
  const data = parsed.data;
  const stationId = await getGeneratorStationId(data.generatorId);
  if (!stationId) return c.json({ error: 'المولد غير موجود' }, 404);
  const denied = requireStationAccess(c, stationId);
  if (denied) return denied;

  const [row] = await db.insert(generatorConsumption).values({
    generatorId: data.generatorId,
    liters: data.liters,
    hoursRun: data.hoursRun != null ? String(data.hoursRun) : null,
    operatorEmployeeId: data.operatorEmployeeId ?? null,
    notes: data.notes ?? null,
    readingDate: parseDateInput(data.readingDate),
  }).returning();
  await auditFuel(c, 'generator_consumption.create', 'generator_consumption', row.id, {
    stationId,
    generatorId: row.generatorId,
    liters: row.liters,
    hoursRun: row.hoursRun,
  });
  return c.json(row, 201);
});

app.delete('/consumption/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) return c.json({ error: 'معرّف غير صالح' }, 400);
  const [current] = await db
    .select({ stationId: generators.stationId })
    .from(generatorConsumption)
    .innerJoin(generators, eq(generatorConsumption.generatorId, generators.id))
    .where(eq(generatorConsumption.id, id))
    .limit(1);
  if (!current) return c.json({ error: 'السجل غير موجود' }, 404);
  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const [row] = await db.delete(generatorConsumption).where(eq(generatorConsumption.id, id)).returning();
  if (!row) return c.json({ error: 'السجل غير موجود' }, 404);
  await auditFuel(c, 'generator_consumption.delete', 'generator_consumption', id, {
    stationId: current.stationId,
    generatorId: row.generatorId,
    liters: row.liters,
  });
  return c.json({ success: true });
});

// ---------- Tank Levels (Calculated Balance) ----------
// Level = sum(receipts into tank) + sum(transfers IN) - sum(transfers OUT) - sum(consumption from rocket tank)
app.get('/levels', async (c) => {
  const stationId = c.req.query('stationId');
  if (!stationId) return c.json({ error: 'stationId مطلوب' }, 400);
  if (!uuidSchema.safeParse(stationId).success) return c.json({ error: 'معرّف المحطة غير صالح' }, 400);
  const denied = requireStationAccess(c, stationId);
  if (denied) return denied;

  const tanksList = await db.select().from(tanks).where(eq(tanks.stationId, stationId));

  const results = await Promise.all(
    tanksList.map(async (tank) => {
      const [{ total: receiptsIn }] = await db
        .select({ total: sql<number>`coalesce(sum(${fuelReceipts.totalLiters}), 0)::int` })
        .from(fuelReceipts)
        .where(eq(fuelReceipts.receivingTankId, tank.id));

      const [{ total: transfersIn }] = await db
        .select({ total: sql<number>`coalesce(sum(${fuelTransfers.liters}), 0)::int` })
        .from(fuelTransfers)
        .where(eq(fuelTransfers.destinationTankId, tank.id));

      const [{ total: transfersOut }] = await db
        .select({ total: sql<number>`coalesce(sum(${fuelTransfers.liters}), 0)::int` })
        .from(fuelTransfers)
        .where(eq(fuelTransfers.sourceTankId, tank.id));

      const [{ total: consumed }] = await db
        .select({ total: sql<number>`coalesce(sum(${generatorConsumption.liters}), 0)::int` })
        .from(generatorConsumption)
        .innerJoin(generators, eq(generatorConsumption.generatorId, generators.id))
        .where(eq(generators.rocketTankId, tank.id));

      const currentLiters =
        Number(receiptsIn) + Number(transfersIn) - Number(transfersOut) - Number(consumed);

      return {
        tankId: tank.id,
        name: tank.name,
        role: tank.role,
        capacityL: tank.capacityL,
        currentLiters,
        receiptsIn: Number(receiptsIn),
        transfersIn: Number(transfersIn),
        transfersOut: Number(transfersOut),
        consumed: Number(consumed),
      };
    })
  );

  return c.json(results);
});

export default app;
