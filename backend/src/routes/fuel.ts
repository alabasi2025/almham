import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
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

const app = new Hono();

// ---------- Suppliers ----------
app.get('/suppliers', async (c) => {
  const rows = await db.select().from(fuelSuppliers).orderBy(fuelSuppliers.createdAt);
  return c.json(rows);
});

app.post('/suppliers', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(fuelSuppliers).values({
    name: body.name,
    phone: body.phone ?? null,
    notes: body.notes ?? null,
  }).returning();
  return c.json(row, 201);
});

app.put('/suppliers/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const [row] = await db.update(fuelSuppliers).set(body).where(eq(fuelSuppliers.id, id)).returning();
  if (!row) return c.json({ error: 'المورد غير موجود' }, 404);
  return c.json(row);
});

app.delete('/suppliers/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(fuelSuppliers).where(eq(fuelSuppliers.id, id)).returning();
  if (!row) return c.json({ error: 'المورد غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Supplier Sites ----------
app.get('/supplier-sites', async (c) => {
  const supplierId = c.req.query('supplierId');
  const rows = supplierId
    ? await db.select().from(supplierSites).where(eq(supplierSites.supplierId, supplierId))
    : await db.select().from(supplierSites);
  return c.json(rows);
});

app.post('/supplier-sites', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(supplierSites).values({
    supplierId: body.supplierId,
    name: body.name,
    location: body.location ?? null,
    latitude: body.latitude != null ? String(body.latitude) : null,
    longitude: body.longitude != null ? String(body.longitude) : null,
  }).returning();
  return c.json(row, 201);
});

app.put('/supplier-sites/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const update: Record<string, unknown> = { ...body };
  if (body.latitude !== undefined) update['latitude'] = body.latitude != null ? String(body.latitude) : null;
  if (body.longitude !== undefined) update['longitude'] = body.longitude != null ? String(body.longitude) : null;
  const [row] = await db.update(supplierSites).set(update).where(eq(supplierSites.id, id)).returning();
  if (!row) return c.json({ error: 'الموقع غير موجود' }, 404);
  return c.json(row);
});

app.delete('/supplier-sites/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(supplierSites).where(eq(supplierSites.id, id)).returning();
  if (!row) return c.json({ error: 'الموقع غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Tankers ----------
app.get('/tankers', async (c) => {
  const rows = await db.select().from(tankers).orderBy(tankers.createdAt);
  return c.json(rows);
});

app.post('/tankers', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(tankers).values({
    plate: body.plate,
    driverName: body.driverName ?? null,
    compartments: body.compartments ?? [],
    notes: body.notes ?? null,
  }).returning();
  return c.json(row, 201);
});

app.put('/tankers/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const [row] = await db.update(tankers).set(body).where(eq(tankers.id, id)).returning();
  if (!row) return c.json({ error: 'الوايت غير موجود' }, 404);
  return c.json(row);
});

app.delete('/tankers/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(tankers).where(eq(tankers.id, id)).returning();
  if (!row) return c.json({ error: 'الوايت غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Tanks ----------
app.get('/tanks', async (c) => {
  const stationId = c.req.query('stationId');
  const rows = stationId
    ? await db.select().from(tanks).where(eq(tanks.stationId, stationId)).orderBy(tanks.createdAt)
    : await db.select().from(tanks).orderBy(tanks.createdAt);
  return c.json(rows);
});

app.post('/tanks', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(tanks).values({
    stationId: body.stationId,
    name: body.name,
    role: body.role,
    material: body.material ?? 'other',
    capacityL: body.capacityL ?? 0,
    notes: body.notes ?? null,
  }).returning();
  return c.json(row, 201);
});

app.put('/tanks/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const [row] = await db.update(tanks).set(body).where(eq(tanks.id, id)).returning();
  if (!row) return c.json({ error: 'الخزان غير موجود' }, 404);
  return c.json(row);
});

app.delete('/tanks/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(tanks).where(eq(tanks.id, id)).returning();
  if (!row) return c.json({ error: 'الخزان غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Pumps ----------
app.get('/pumps', async (c) => {
  const stationId = c.req.query('stationId');
  const rows = stationId
    ? await db.select().from(pumps).where(eq(pumps.stationId, stationId)).orderBy(pumps.createdAt)
    : await db.select().from(pumps).orderBy(pumps.createdAt);
  return c.json(rows);
});

app.post('/pumps', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(pumps).values({
    stationId: body.stationId,
    name: body.name,
    inletsCount: body.inletsCount ?? 1,
    outletsCount: body.outletsCount ?? 1,
    metersCount: body.metersCount ?? 1,
    notes: body.notes ?? null,
  }).returning();
  return c.json(row, 201);
});

app.put('/pumps/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const [row] = await db.update(pumps).set(body).where(eq(pumps.id, id)).returning();
  if (!row) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  return c.json(row);
});

app.delete('/pumps/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(pumps).where(eq(pumps.id, id)).returning();
  if (!row) return c.json({ error: 'الطرمبة غير موجودة' }, 404);
  return c.json({ success: true });
});

// ---------- Pump Channels ----------
app.get('/pump-channels', async (c) => {
  const pumpId = c.req.query('pumpId');
  const rows = pumpId
    ? await db.select().from(pumpChannels).where(eq(pumpChannels.pumpId, pumpId)).orderBy(pumpChannels.channelIndex)
    : await db.select().from(pumpChannels).orderBy(pumpChannels.channelIndex);
  return c.json(rows);
});

app.post('/pump-channels', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(pumpChannels).values({
    pumpId: body.pumpId,
    channelIndex: body.channelIndex,
    sourceTankId: body.sourceTankId ?? null,
    destinationTankId: body.destinationTankId ?? null,
    meterLabel: body.meterLabel ?? null,
  }).returning();
  return c.json(row, 201);
});

app.put('/pump-channels/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const [row] = await db.update(pumpChannels).set(body).where(eq(pumpChannels.id, id)).returning();
  if (!row) return c.json({ error: 'القناة غير موجودة' }, 404);
  return c.json(row);
});

app.delete('/pump-channels/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(pumpChannels).where(eq(pumpChannels.id, id)).returning();
  if (!row) return c.json({ error: 'القناة غير موجودة' }, 404);
  return c.json({ success: true });
});

// ---------- Generators ----------
app.get('/generators', async (c) => {
  const stationId = c.req.query('stationId');
  const rows = stationId
    ? await db.select().from(generators).where(eq(generators.stationId, stationId)).orderBy(generators.createdAt)
    : await db.select().from(generators).orderBy(generators.createdAt);
  return c.json(rows);
});

app.post('/generators', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(generators).values({
    stationId: body.stationId,
    name: body.name,
    model: body.model ?? null,
    capacityKw: body.capacityKw ?? 0,
    isBackup: body.isBackup ?? false,
    rocketTankId: body.rocketTankId ?? null,
    notes: body.notes ?? null,
  }).returning();
  return c.json(row, 201);
});

app.put('/generators/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const [row] = await db.update(generators).set(body).where(eq(generators.id, id)).returning();
  if (!row) return c.json({ error: 'المولد غير موجود' }, 404);
  return c.json(row);
});

app.delete('/generators/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(generators).where(eq(generators.id, id)).returning();
  if (!row) return c.json({ error: 'المولد غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Fuel Receipts ----------
app.get('/receipts', async (c) => {
  const stationId = c.req.query('stationId');
  const rows = stationId
    ? await db.select().from(fuelReceipts).where(eq(fuelReceipts.stationId, stationId)).orderBy(fuelReceipts.receivedAt)
    : await db.select().from(fuelReceipts).orderBy(fuelReceipts.receivedAt);
  return c.json(rows);
});

app.post('/receipts', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(fuelReceipts).values({
    stationId: body.stationId,
    supplierId: body.supplierId ?? null,
    supplierSiteId: body.supplierSiteId ?? null,
    tankerId: body.tankerId ?? null,
    receiverEmployeeId: body.receiverEmployeeId ?? null,
    receivingTankId: body.receivingTankId ?? null,
    supplierRepName: body.supplierRepName ?? null,
    meterBefore: body.meterBefore ?? null,
    meterAfter: body.meterAfter ?? null,
    compartmentsFilled: body.compartmentsFilled ?? null,
    totalLiters: body.totalLiters,
    voucherNumber: body.voucherNumber ?? null,
    voucherOriginalHolder: body.voucherOriginalHolder ?? null,
    invoicePhotoUrl: body.invoicePhotoUrl ?? null,
    meterBeforePhotoUrl: body.meterBeforePhotoUrl ?? null,
    meterAfterPhotoUrl: body.meterAfterPhotoUrl ?? null,
    notes: body.notes ?? null,
    receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
  }).returning();
  return c.json(row, 201);
});

app.delete('/receipts/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(fuelReceipts).where(eq(fuelReceipts.id, id)).returning();
  if (!row) return c.json({ error: 'السند غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Fuel Transfers ----------
app.get('/transfers', async (c) => {
  const stationId = c.req.query('stationId');
  const rows = stationId
    ? await db.select().from(fuelTransfers).where(eq(fuelTransfers.stationId, stationId)).orderBy(fuelTransfers.transferredAt)
    : await db.select().from(fuelTransfers).orderBy(fuelTransfers.transferredAt);
  return c.json(rows);
});

app.post('/transfers', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(fuelTransfers).values({
    stationId: body.stationId,
    sourceTankId: body.sourceTankId,
    destinationTankId: body.destinationTankId,
    pumpChannelId: body.pumpChannelId ?? null,
    meterReadingBefore: body.meterReadingBefore ?? null,
    meterReadingAfter: body.meterReadingAfter ?? null,
    liters: body.liters,
    operatorEmployeeId: body.operatorEmployeeId ?? null,
    notes: body.notes ?? null,
    transferredAt: body.transferredAt ? new Date(body.transferredAt) : new Date(),
  }).returning();
  return c.json(row, 201);
});

app.delete('/transfers/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(fuelTransfers).where(eq(fuelTransfers.id, id)).returning();
  if (!row) return c.json({ error: 'التحويل غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Generator Consumption ----------
app.get('/consumption', async (c) => {
  const generatorId = c.req.query('generatorId');
  const stationId = c.req.query('stationId');
  if (generatorId) {
    const rows = await db.select().from(generatorConsumption).where(eq(generatorConsumption.generatorId, generatorId)).orderBy(generatorConsumption.readingDate);
    return c.json(rows);
  }
  if (stationId) {
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
  const rows = await db.select().from(generatorConsumption).orderBy(generatorConsumption.readingDate);
  return c.json(rows);
});

app.post('/consumption', async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(generatorConsumption).values({
    generatorId: body.generatorId,
    liters: body.liters,
    hoursRun: body.hoursRun ?? null,
    operatorEmployeeId: body.operatorEmployeeId ?? null,
    notes: body.notes ?? null,
    readingDate: body.readingDate ? new Date(body.readingDate) : new Date(),
  }).returning();
  return c.json(row, 201);
});

app.delete('/consumption/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.delete(generatorConsumption).where(eq(generatorConsumption.id, id)).returning();
  if (!row) return c.json({ error: 'السجل غير موجود' }, 404);
  return c.json({ success: true });
});

// ---------- Tank Levels (Calculated Balance) ----------
// Level = sum(receipts into tank) + sum(transfers IN) - sum(transfers OUT) - sum(consumption from rocket tank)
app.get('/levels', async (c) => {
  const stationId = c.req.query('stationId');
  if (!stationId) return c.json({ error: 'stationId مطلوب' }, 400);

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
