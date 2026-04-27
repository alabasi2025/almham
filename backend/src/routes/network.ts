import { Hono } from 'hono';
import { eq, and, sql, SQL } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '../db/index.js';
import {
  feeders,
  panels,
  stations,
  employees,
  feederSegments,
  cableTypes,
  generators,
  monitoringMeters,
  feederPanelBreakers,
  busbarTypes,
  feederPanelBusbars,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { stationScopeCondition, requireStationAccess, requireGlobalAccess } from '../lib/access-control.js';
import { recordAudit } from '../lib/audit.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

// ==================== FEEDERS ====================

const feederSchema = z.object({
  stationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(64).nullable().optional(),
  responsibleEmployeeId: z.string().uuid().nullable().optional(),
  cableType: z.string().max(128).nullable().optional(),
  maxLoadAmps: z.number().int().positive().nullable().optional(),
  lengthMeters: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'off', 'maintenance', 'overloaded']).optional(),
  notes: z.string().nullable().optional(),
  routeCoordinates: z.array(z.tuple([z.number(), z.number()])).nullable().optional(),
});

app.get('/feeders', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, feeders.stationId, stationId);
  if (scope) conditions.push(scope);

  const rows = await db
    .select({
      id: feeders.id,
      stationId: feeders.stationId,
      stationName: stations.name,
      name: feeders.name,
      code: feeders.code,
      responsibleEmployeeId: feeders.responsibleEmployeeId,
      responsibleEmployeeName: employees.name,
      cableType: feeders.cableType,
      maxLoadAmps: feeders.maxLoadAmps,
      lengthMeters: feeders.lengthMeters,
      status: feeders.status,
      notes: feeders.notes,
      routeCoordinates: feeders.routeCoordinates,
      createdAt: feeders.createdAt,
      panelsCount: sql<number>`(SELECT COUNT(*) FROM panels WHERE panels.feeder_id = ${feeders.id})`.as('panels_count'),
    })
    .from(feeders)
    .leftJoin(stations, eq(feeders.stationId, stations.id))
    .leftJoin(employees, eq(feeders.responsibleEmployeeId, employees.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(feeders.createdAt);

  return c.json(rows);
});

app.post('/feeders', async (c) => {
  const parsed = feederSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;

  const [created] = await db.insert(feeders).values({
    stationId: data.stationId,
    name: data.name,
    code: data.code ?? null,
    responsibleEmployeeId: data.responsibleEmployeeId ?? null,
    cableType: data.cableType ?? null,
    maxLoadAmps: data.maxLoadAmps ?? null,
    lengthMeters: data.lengthMeters ?? null,
    status: data.status ?? 'active',
    notes: data.notes ?? null,
    routeCoordinates: data.routeCoordinates ?? null,
  }).returning();

  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_create', entityType: 'feeders', entityId: created.id, metadata: data });
  return c.json(created, 201);
});

app.put('/feeders/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feeders).where(eq(feeders.id, id)).limit(1);
  if (!current) return c.json({ error: 'الفيدر غير موجود' }, 404);

  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const body = await c.req.json();
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.code !== undefined) updateData.code = body.code;
  if (body.responsibleEmployeeId !== undefined) updateData.responsibleEmployeeId = body.responsibleEmployeeId;
  if (body.cableType !== undefined) updateData.cableType = body.cableType;
  if (body.maxLoadAmps !== undefined) updateData.maxLoadAmps = body.maxLoadAmps;
  if (body.lengthMeters !== undefined) updateData.lengthMeters = body.lengthMeters;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.routeCoordinates !== undefined) updateData.routeCoordinates = body.routeCoordinates;

  const [updated] = await db.update(feeders).set(updateData).where(eq(feeders.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_update', entityType: 'feeders', entityId: id, metadata: updateData });
  return c.json(updated);
});

app.delete('/feeders/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feeders).where(eq(feeders.id, id)).limit(1);
  if (!current) return c.json({ error: 'الفيدر غير موجود' }, 404);

  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  await db.delete(feeders).where(eq(feeders.id, id));
  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_delete', entityType: 'feeders', entityId: id, metadata: { name: current.name } });
  return c.json({ success: true });
});

// ==================== FEEDER SEGMENTS ====================

const segmentSchema = z.object({
  parentSegmentId: z.string().uuid().nullable().optional(),
  cableTypeId: z.string().uuid().nullable().optional(),
  segmentType: z.enum(['main', 'branch']).optional(),
  phaseConfig: z.enum(['single_phase_earth', 'two_phase_earth', 'three_phase_earth', 'earth_only', 'other']).optional(),
  earthMode: z.enum(['insulated', 'bare', 'none']).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  label: z.string().max(255).nullable().optional(),
  lengthMeters: z.number().positive().nullable().optional(),
  routePoints: z.array(z.tuple([z.number(), z.number()])).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// GET /segments — list all segments in scope for monitoring selectors
app.get('/segments', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const feederId = c.req.query('feederId');
  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, feeders.stationId, stationId);
  if (scope) conditions.push(scope);
  if (feederId) conditions.push(eq(feederSegments.feederId, feederId));

  const rows = await db
    .select({
      id: feederSegments.id,
      feederId: feederSegments.feederId,
      stationId: feeders.stationId,
      feederName: feeders.name,
      parentSegmentId: feederSegments.parentSegmentId,
      cableTypeId: feederSegments.cableTypeId,
      cableTypeName: cableTypes.name,
      cableTypeColor: cableTypes.color,
      cableTypePhaseConfig: cableTypes.phaseConfig,
      cableTypeEarthMode: cableTypes.earthMode,
      segmentType: feederSegments.segmentType,
      phaseConfig: feederSegments.phaseConfig,
      earthMode: feederSegments.earthMode,
      orderIndex: feederSegments.orderIndex,
      label: feederSegments.label,
      lengthMeters: feederSegments.lengthMeters,
      routePoints: feederSegments.routePoints,
      notes: feederSegments.notes,
      createdAt: feederSegments.createdAt,
    })
    .from(feederSegments)
    .innerJoin(feeders, eq(feederSegments.feederId, feeders.id))
    .leftJoin(cableTypes, eq(feederSegments.cableTypeId, cableTypes.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(feeders.name, feederSegments.segmentType, feederSegments.orderIndex);

  return c.json(rows);
});

// GET /feeders/:feederId/segments — list segments for a feeder with cable type info
app.get('/feeders/:feederId/segments', async (c) => {
  const feederId = c.req.param('feederId');

  // Verify feeder exists and check access
  const [feeder] = await db.select().from(feeders).where(eq(feeders.id, feederId)).limit(1);
  if (!feeder) return c.json({ error: 'الفيدر غير موجود' }, 404);

  const denied = requireStationAccess(c, feeder.stationId);
  if (denied) return denied;

  const rows = await db
    .select({
      id: feederSegments.id,
      feederId: feederSegments.feederId,
      parentSegmentId: feederSegments.parentSegmentId,
      cableTypeId: feederSegments.cableTypeId,
      cableTypeName: cableTypes.name,
      cableTypeColor: cableTypes.color,
      cableTypePhaseConfig: cableTypes.phaseConfig,
      cableTypeEarthMode: cableTypes.earthMode,
      segmentType: feederSegments.segmentType,
      phaseConfig: feederSegments.phaseConfig,
      earthMode: feederSegments.earthMode,
      orderIndex: feederSegments.orderIndex,
      label: feederSegments.label,
      lengthMeters: feederSegments.lengthMeters,
      routePoints: feederSegments.routePoints,
      notes: feederSegments.notes,
      createdAt: feederSegments.createdAt,
    })
    .from(feederSegments)
    .leftJoin(cableTypes, eq(feederSegments.cableTypeId, cableTypes.id))
    .where(eq(feederSegments.feederId, feederId))
    .orderBy(feederSegments.segmentType, feederSegments.orderIndex);

  return c.json(rows);
});

// POST /feeders/:feederId/segments — create segment
app.post('/feeders/:feederId/segments', async (c) => {
  const feederId = c.req.param('feederId');

  const [feeder] = await db.select().from(feeders).where(eq(feeders.id, feederId)).limit(1);
  if (!feeder) return c.json({ error: 'الفيدر غير موجود' }, 404);

  const denied = requireStationAccess(c, feeder.stationId);
  if (denied) return denied;

  const parsed = segmentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const [created] = await db.insert(feederSegments).values({
    feederId,
    parentSegmentId: data.parentSegmentId ?? null,
    cableTypeId: data.cableTypeId ?? null,
    segmentType: data.segmentType ?? 'main',
    phaseConfig: data.phaseConfig ?? 'single_phase_earth',
    earthMode: data.earthMode ?? 'insulated',
    orderIndex: data.orderIndex ?? 0,
    label: data.label ?? null,
    lengthMeters: data.lengthMeters?.toString() ?? null,
    routePoints: data.routePoints ?? null,
    notes: data.notes ?? null,
  }).returning();

  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'segment_create',
    entityType: 'feeder_segments',
    entityId: created.id,
    metadata: { feederId, ...data },
  });
  return c.json(created, 201);
});

// PUT /segments/:id — update segment
app.put('/segments/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feederSegments).where(eq(feederSegments.id, id)).limit(1);
  if (!current) return c.json({ error: 'المقطع غير موجود' }, 404);

  // Get feeder to check station access
  const [feeder] = await db.select().from(feeders).where(eq(feeders.id, current.feederId)).limit(1);
  if (!feeder) return c.json({ error: 'الفيدر غير موجود' }, 404);

  const denied = requireStationAccess(c, feeder.stationId);
  if (denied) return denied;

  const body = await c.req.json();
  const updateData: Record<string, unknown> = {};
  if (body.parentSegmentId !== undefined) updateData.parentSegmentId = body.parentSegmentId;
  if (body.cableTypeId !== undefined) updateData.cableTypeId = body.cableTypeId;
  if (body.segmentType !== undefined) updateData.segmentType = body.segmentType;
  if (body.phaseConfig !== undefined) updateData.phaseConfig = body.phaseConfig;
  if (body.earthMode !== undefined) updateData.earthMode = body.earthMode;
  if (body.orderIndex !== undefined) updateData.orderIndex = body.orderIndex;
  if (body.label !== undefined) updateData.label = body.label;
  if (body.lengthMeters !== undefined) updateData.lengthMeters = body.lengthMeters?.toString() ?? null;
  if (body.routePoints !== undefined) updateData.routePoints = body.routePoints;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const [updated] = await db.update(feederSegments).set(updateData).where(eq(feederSegments.id, id)).returning();
  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'segment_update',
    entityType: 'feeder_segments',
    entityId: id,
    metadata: updateData,
  });
  return c.json(updated);
});

// DELETE /segments/:id — delete segment
app.delete('/segments/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feederSegments).where(eq(feederSegments.id, id)).limit(1);
  if (!current) return c.json({ error: 'المقطع غير موجود' }, 404);

  const [feeder] = await db.select().from(feeders).where(eq(feeders.id, current.feederId)).limit(1);
  if (!feeder) return c.json({ error: 'الفيدر غير موجود' }, 404);

  const denied = requireStationAccess(c, feeder.stationId);
  if (denied) return denied;

  await db.delete(feederSegments).where(eq(feederSegments.id, id));
  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'segment_delete',
    entityType: 'feeder_segments',
    entityId: id,
    metadata: { feederId: current.feederId, label: current.label },
  });
  return c.json({ success: true });
});

// ==================== PANELS ====================

const panelSchema = z.object({
  stationId: z.string().uuid(),
  feederId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  code: z.string().max(64).nullable().optional(),
  type: z.enum(['sync', 'main_distribution', 'meter_box']).optional(),
  controllerType: z.string().max(128).nullable().optional(),
  capacityAmps: z.number().int().positive().nullable().optional(),
  busbarLayout: z.enum(['right', 'left', 'both']).optional(),
  breakerLayout: z.enum(['right', 'left', 'both']).optional(),
  busbarMaterial: z.string().max(64).nullable().optional(),
  busbarRatingAmps: z.number().int().positive().nullable().optional(),
  poleNumber: z.string().max(64).nullable().optional(),
  maxSlots: z.number().int().positive().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  notes: z.string().nullable().optional(),
});

app.get('/panels', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const feederId = c.req.query('feederId');
  const type = c.req.query('type');
  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, panels.stationId, stationId);
  if (scope) conditions.push(scope);
  if (feederId) conditions.push(eq(panels.feederId, feederId));
  if (type) conditions.push(eq(panels.type, type as 'sync' | 'main_distribution' | 'meter_box'));

  const rows = await db
    .select({
      id: panels.id,
      stationId: panels.stationId,
      stationName: stations.name,
      feederId: panels.feederId,
      feederName: feeders.name,
      name: panels.name,
      code: panels.code,
      type: panels.type,
      controllerType: panels.controllerType,
      capacityAmps: panels.capacityAmps,
      busbarLayout: panels.busbarLayout,
      breakerLayout: panels.breakerLayout,
      busbarMaterial: panels.busbarMaterial,
      busbarRatingAmps: panels.busbarRatingAmps,
      poleNumber: panels.poleNumber,
      maxSlots: panels.maxSlots,
      latitude: panels.latitude,
      longitude: panels.longitude,
      status: panels.status,
      notes: panels.notes,
      createdAt: panels.createdAt,
      breakersCount: sql<number>`(SELECT COUNT(*) FROM feeder_panel_breakers WHERE feeder_panel_breakers.panel_id = ${panels.id})`.as('breakers_count'),
      busbarsCount: sql<number>`(SELECT COUNT(*) FROM feeder_panel_busbars WHERE feeder_panel_busbars.panel_id = ${panels.id})`.as('busbars_count'),
    })
    .from(panels)
    .leftJoin(stations, eq(panels.stationId, stations.id))
    .leftJoin(feeders, eq(panels.feederId, feeders.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(panels.type, panels.name);

  return c.json(rows);
});

app.post('/panels', async (c) => {
  const parsed = panelSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;

  const [created] = await db.insert(panels).values({
    stationId: data.stationId,
    feederId: data.type === 'main_distribution' || data.type === 'sync' ? null : data.feederId ?? null,
    name: data.name,
    code: data.code ?? null,
    type: data.type ?? 'meter_box',
    controllerType: data.controllerType ?? null,
    capacityAmps: data.capacityAmps ?? null,
    busbarLayout: data.busbarLayout ?? 'right',
    breakerLayout: data.breakerLayout ?? 'both',
    busbarMaterial: data.busbarMaterial ?? 'نحاس',
    busbarRatingAmps: data.busbarRatingAmps ?? null,
    poleNumber: data.poleNumber ?? null,
    maxSlots: data.maxSlots ?? null,
    latitude: data.latitude?.toString() ?? null,
    longitude: data.longitude?.toString() ?? null,
    status: data.status ?? 'active',
    notes: data.notes ?? null,
  }).returning();

  await recordAudit({ userId: c.get('auth').user.id, action: 'panel_create', entityType: 'panels', entityId: created.id, metadata: data });
  return c.json(created, 201);
});

app.put('/panels/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(panels).where(eq(panels.id, id)).limit(1);
  if (!current) return c.json({ error: 'الطبلة غير موجودة' }, 404);

  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const body = await c.req.json();
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.code !== undefined) updateData.code = body.code;
  if (body.feederId !== undefined) updateData.feederId = body.feederId;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.controllerType !== undefined) updateData.controllerType = body.controllerType;
  if (body.capacityAmps !== undefined) updateData.capacityAmps = body.capacityAmps;
  if (body.busbarLayout !== undefined) updateData.busbarLayout = body.busbarLayout;
  if (body.breakerLayout !== undefined) updateData.breakerLayout = body.breakerLayout;
  if (body.busbarMaterial !== undefined) updateData.busbarMaterial = body.busbarMaterial;
  if (body.busbarRatingAmps !== undefined) updateData.busbarRatingAmps = body.busbarRatingAmps;
  if (body.poleNumber !== undefined) updateData.poleNumber = body.poleNumber;
  if (body.maxSlots !== undefined) updateData.maxSlots = body.maxSlots;
  if (body.latitude !== undefined) updateData.latitude = body.latitude?.toString() ?? null;
  if (body.longitude !== undefined) updateData.longitude = body.longitude?.toString() ?? null;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.type === 'main_distribution' || body.type === 'sync') updateData.feederId = null;

  const [updated] = await db.update(panels).set(updateData).where(eq(panels.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'panel_update', entityType: 'panels', entityId: id, metadata: updateData });
  return c.json(updated);
});

app.delete('/panels/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(panels).where(eq(panels.id, id)).limit(1);
  if (!current) return c.json({ error: 'الطبلة غير موجودة' }, 404);

  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  await db.delete(panels).where(eq(panels.id, id));
  await recordAudit({ userId: c.get('auth').user.id, action: 'panel_delete', entityType: 'panels', entityId: id, metadata: { name: current.name } });
  return c.json({ success: true });
});

// ==================== BUSBAR TYPES ====================

const busbarTypeSchema = z.object({
  name: z.string().min(1).max(128),
  material: z.string().max(64).nullable().optional(),
  widthMm: z.coerce.number().positive().nullable().optional(),
  thicknessMm: z.coerce.number().positive().nullable().optional(),
  ratingAmps: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

app.get('/busbar-types', async (c) => {
  const showAll = c.req.query('all') === 'true';
  const rows = await db
    .select()
    .from(busbarTypes)
    .where(showAll ? undefined : eq(busbarTypes.isActive, true))
    .orderBy(busbarTypes.name);
  return c.json(rows);
});

app.post('/busbar-types', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const parsed = busbarTypeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات نوع البزبار غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const [created] = await db.insert(busbarTypes).values({
    name: data.name,
    material: data.material ?? 'نحاس',
    widthMm: data.widthMm?.toString() ?? null,
    thicknessMm: data.thicknessMm?.toString() ?? null,
    ratingAmps: data.ratingAmps ?? null,
    notes: data.notes ?? null,
    isActive: data.isActive ?? true,
  }).returning();

  await recordAudit({ userId: c.get('auth').user.id, action: 'busbar_type_create', entityType: 'busbar_types', entityId: created.id, metadata: data });
  return c.json(created, 201);
});

app.put('/busbar-types/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  const [current] = await db.select().from(busbarTypes).where(eq(busbarTypes.id, id)).limit(1);
  if (!current) return c.json({ error: 'نوع البزبار غير موجود' }, 404);

  const parsed = busbarTypeSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات نوع البزبار غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.material !== undefined) updateData.material = data.material;
  if (data.widthMm !== undefined) updateData.widthMm = data.widthMm?.toString() ?? null;
  if (data.thicknessMm !== undefined) updateData.thicknessMm = data.thicknessMm?.toString() ?? null;
  if (data.ratingAmps !== undefined) updateData.ratingAmps = data.ratingAmps;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [updated] = await db.update(busbarTypes).set(updateData).where(eq(busbarTypes.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'busbar_type_update', entityType: 'busbar_types', entityId: id, metadata: updateData });
  return c.json(updated);
});

app.delete('/busbar-types/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  const [current] = await db.select().from(busbarTypes).where(eq(busbarTypes.id, id)).limit(1);
  if (!current) return c.json({ error: 'نوع البزبار غير موجود' }, 404);

  const [updated] = await db.update(busbarTypes).set({ isActive: false }).where(eq(busbarTypes.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'busbar_type_delete', entityType: 'busbar_types', entityId: id, metadata: { name: current.name } });
  return c.json(updated);
});

// ==================== FEEDER PANEL BUSBARS ====================

const feederPanelBusbarSchema = z.object({
  busbarTypeId: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(128),
  role: z.enum(['phase_a', 'phase_b', 'phase_c', 'neutral', 'earth', 'spare', 'other']).optional(),
  position: z.enum(['right', 'left', 'middle']).optional(),
  orderIndex: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
});

async function ensureBusbarTypeExists(busbarTypeId: string | null | undefined) {
  if (!busbarTypeId) return null;
  const [row] = await db.select({ id: busbarTypes.id }).from(busbarTypes).where(eq(busbarTypes.id, busbarTypeId)).limit(1);
  return row ? null : 'نوع البزبار غير موجود';
}

app.get('/panels/:panelId/busbars', async (c) => {
  const panelId = c.req.param('panelId');
  const panel = await getFeederPanel(panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);
  if (panel.type !== 'main_distribution') return c.json({ error: 'البزبارات تخص طبلة فيدرات فقط' }, 400);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  const rows = await db
    .select({
      id: feederPanelBusbars.id,
      panelId: feederPanelBusbars.panelId,
      busbarTypeId: feederPanelBusbars.busbarTypeId,
      busbarTypeName: busbarTypes.name,
      busbarMaterial: busbarTypes.material,
      widthMm: busbarTypes.widthMm,
      thicknessMm: busbarTypes.thicknessMm,
      ratingAmps: busbarTypes.ratingAmps,
      label: feederPanelBusbars.label,
      role: feederPanelBusbars.role,
      position: feederPanelBusbars.position,
      orderIndex: feederPanelBusbars.orderIndex,
      notes: feederPanelBusbars.notes,
      createdAt: feederPanelBusbars.createdAt,
    })
    .from(feederPanelBusbars)
    .leftJoin(busbarTypes, eq(feederPanelBusbars.busbarTypeId, busbarTypes.id))
    .where(eq(feederPanelBusbars.panelId, panelId))
    .orderBy(feederPanelBusbars.position, feederPanelBusbars.orderIndex, feederPanelBusbars.label);

  return c.json(rows);
});

app.post('/panels/:panelId/busbars', async (c) => {
  const panelId = c.req.param('panelId');
  const panel = await getFeederPanel(panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);
  if (panel.type !== 'main_distribution') return c.json({ error: 'البزبارات تخص طبلة فيدرات فقط' }, 400);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  const parsed = feederPanelBusbarSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات البزبار غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const typeError = await ensureBusbarTypeExists(data.busbarTypeId);
  if (typeError) return c.json({ error: typeError }, 404);

  const [created] = await db.insert(feederPanelBusbars).values({
    panelId,
    busbarTypeId: data.busbarTypeId ?? null,
    label: data.label,
    role: data.role ?? 'other',
    position: data.position ?? 'right',
    orderIndex: data.orderIndex ?? 0,
    notes: data.notes ?? null,
  }).returning();

  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_panel_busbar_create', entityType: 'feeder_panel_busbars', entityId: created.id, metadata: { panelId, ...data } });
  return c.json(created, 201);
});

app.put('/panel-busbars/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feederPanelBusbars).where(eq(feederPanelBusbars.id, id)).limit(1);
  if (!current) return c.json({ error: 'البزبار غير موجود' }, 404);

  const panel = await getFeederPanel(current.panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  const parsed = feederPanelBusbarSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات البزبار غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const typeError = await ensureBusbarTypeExists(data.busbarTypeId !== undefined ? data.busbarTypeId : current.busbarTypeId);
  if (typeError) return c.json({ error: typeError }, 404);

  const updateData: Record<string, unknown> = {};
  if (data.busbarTypeId !== undefined) updateData.busbarTypeId = data.busbarTypeId;
  if (data.label !== undefined) updateData.label = data.label;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updated] = await db.update(feederPanelBusbars).set(updateData).where(eq(feederPanelBusbars.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_panel_busbar_update', entityType: 'feeder_panel_busbars', entityId: id, metadata: updateData });
  return c.json(updated);
});

app.delete('/panel-busbars/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feederPanelBusbars).where(eq(feederPanelBusbars.id, id)).limit(1);
  if (!current) return c.json({ error: 'البزبار غير موجود' }, 404);

  const panel = await getFeederPanel(current.panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  await db.delete(feederPanelBusbars).where(eq(feederPanelBusbars.id, id));
  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_panel_busbar_delete', entityType: 'feeder_panel_busbars', entityId: id, metadata: { panelId: current.panelId, label: current.label } });
  return c.json({ success: true });
});

// ==================== FEEDER PANEL BREAKERS ====================

const feederPanelBreakerSchema = z.object({
  feederId: z.string().uuid().nullable().optional(),
  breakerNumber: z.string().min(1).max(64),
  side: z.enum(['right', 'left']).optional(),
  ratingAmps: z.number().int().positive().nullable().optional(),
  breakerType: z.string().max(128).nullable().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  notes: z.string().nullable().optional(),
});

async function getFeederPanel(panelId: string) {
  const [panel] = await db.select().from(panels).where(eq(panels.id, panelId)).limit(1);
  if (!panel) return null;
  return panel;
}

async function ensureBreakerFeederMatchesPanel(feederId: string | null | undefined, panelStationId: string) {
  if (!feederId) return null;
  const [feeder] = await db
    .select({ stationId: feeders.stationId })
    .from(feeders)
    .where(eq(feeders.id, feederId))
    .limit(1);
  if (!feeder) return 'الفيدر غير موجود';
  if (feeder.stationId !== panelStationId) return 'الفيدر يجب أن يكون من نفس محطة طبلة الفيدرات';
  return null;
}

app.get('/panels/:panelId/breakers', async (c) => {
  const panelId = c.req.param('panelId');
  const panel = await getFeederPanel(panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);
  if (panel.type !== 'main_distribution') return c.json({ error: 'القواطع تخص طبلة فيدرات فقط' }, 400);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  const rows = await db
    .select({
      id: feederPanelBreakers.id,
      panelId: feederPanelBreakers.panelId,
      feederId: feederPanelBreakers.feederId,
      feederName: feeders.name,
      breakerNumber: feederPanelBreakers.breakerNumber,
      side: feederPanelBreakers.side,
      ratingAmps: feederPanelBreakers.ratingAmps,
      breakerType: feederPanelBreakers.breakerType,
      status: feederPanelBreakers.status,
      notes: feederPanelBreakers.notes,
      createdAt: feederPanelBreakers.createdAt,
    })
    .from(feederPanelBreakers)
    .leftJoin(feeders, eq(feederPanelBreakers.feederId, feeders.id))
    .where(eq(feederPanelBreakers.panelId, panelId))
    .orderBy(feederPanelBreakers.side, feederPanelBreakers.breakerNumber);

  return c.json(rows);
});

app.post('/panels/:panelId/breakers', async (c) => {
  const panelId = c.req.param('panelId');
  const panel = await getFeederPanel(panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);
  if (panel.type !== 'main_distribution') return c.json({ error: 'القواطع تخص طبلة فيدرات فقط' }, 400);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  const parsed = feederPanelBreakerSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات القاطع غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const feederError = await ensureBreakerFeederMatchesPanel(data.feederId, panel.stationId);
  if (feederError) return c.json({ error: feederError }, feederError === 'الفيدر غير موجود' ? 404 : 400);

  const [created] = await db.insert(feederPanelBreakers).values({
    panelId,
    feederId: data.feederId ?? null,
    breakerNumber: data.breakerNumber,
    side: data.side ?? 'right',
    ratingAmps: data.ratingAmps ?? null,
    breakerType: data.breakerType ?? null,
    status: data.status ?? 'active',
    notes: data.notes ?? null,
  }).returning();

  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_panel_breaker_create', entityType: 'feeder_panel_breakers', entityId: created.id, metadata: { panelId, ...data } });
  return c.json(created, 201);
});

app.put('/breakers/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feederPanelBreakers).where(eq(feederPanelBreakers.id, id)).limit(1);
  if (!current) return c.json({ error: 'القاطع غير موجود' }, 404);

  const panel = await getFeederPanel(current.panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  const parsed = feederPanelBreakerSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات القاطع غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const feederError = await ensureBreakerFeederMatchesPanel(data.feederId !== undefined ? data.feederId : current.feederId, panel.stationId);
  if (feederError) return c.json({ error: feederError }, feederError === 'الفيدر غير موجود' ? 404 : 400);

  const updateData: Record<string, unknown> = {};
  if (data.feederId !== undefined) updateData.feederId = data.feederId;
  if (data.breakerNumber !== undefined) updateData.breakerNumber = data.breakerNumber;
  if (data.side !== undefined) updateData.side = data.side;
  if (data.ratingAmps !== undefined) updateData.ratingAmps = data.ratingAmps;
  if (data.breakerType !== undefined) updateData.breakerType = data.breakerType;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updated] = await db.update(feederPanelBreakers).set(updateData).where(eq(feederPanelBreakers.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_panel_breaker_update', entityType: 'feeder_panel_breakers', entityId: id, metadata: updateData });
  return c.json(updated);
});

app.delete('/breakers/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(feederPanelBreakers).where(eq(feederPanelBreakers.id, id)).limit(1);
  if (!current) return c.json({ error: 'القاطع غير موجود' }, 404);

  const panel = await getFeederPanel(current.panelId);
  if (!panel) return c.json({ error: 'طبلة الفيدرات غير موجودة' }, 404);

  const denied = requireStationAccess(c, panel.stationId);
  if (denied) return denied;

  await db.delete(feederPanelBreakers).where(eq(feederPanelBreakers.id, id));
  await recordAudit({ userId: c.get('auth').user.id, action: 'feeder_panel_breaker_delete', entityType: 'feeder_panel_breakers', entityId: id, metadata: { panelId: current.panelId, breakerNumber: current.breakerNumber } });
  return c.json({ success: true });
});

// ==================== MONITORING METERS ====================

const monitoringTargetTypeValues = [
  'generator',
  'sync_panel',
  'feeder_panel',
  'feeder',
  'main_segment',
  'branch_segment',
  'panel',
] as const;

type MonitoringTargetType = typeof monitoringTargetTypeValues[number];

const monitoringMeterSchema = z.object({
  stationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(64).nullable().optional(),
  targetType: z.enum(monitoringTargetTypeValues),
  targetId: z.string().uuid().nullable().optional(),
  kind: z.enum(['production', 'distribution', 'consumption', 'load', 'voltage', 'loss_check']).optional(),
  lastVoltage: z.coerce.number().nullable().optional(),
  lastCurrent: z.coerce.number().nullable().optional(),
  lastKwh: z.coerce.number().nullable().optional(),
  lastPowerKw: z.coerce.number().nullable().optional(),
  loadPercent: z.coerce.number().int().min(0).max(999).nullable().optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'alarm']).optional(),
  lastReadAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveMonitoringTargetStation(targetType: MonitoringTargetType, targetId: string) {
  if (targetType === 'generator') {
    const [row] = await db
      .select({ stationId: generators.stationId })
      .from(generators)
      .where(eq(generators.id, targetId))
      .limit(1);
    return row ? { stationId: row.stationId } : null;
  }

  if (targetType === 'feeder') {
    const [row] = await db
      .select({ stationId: feeders.stationId })
      .from(feeders)
      .where(eq(feeders.id, targetId))
      .limit(1);
    return row ? { stationId: row.stationId } : null;
  }

  if (targetType === 'sync_panel' || targetType === 'feeder_panel' || targetType === 'panel') {
    const [row] = await db
      .select({ stationId: panels.stationId, type: panels.type })
      .from(panels)
      .where(eq(panels.id, targetId))
      .limit(1);
    if (!row) return null;
    if (targetType === 'sync_panel' && row.type !== 'sync') return { stationId: row.stationId, error: 'اختر طبلة دمج صحيحة' };
    if (targetType === 'feeder_panel' && row.type !== 'main_distribution') return { stationId: row.stationId, error: 'اختر طبلة فيدرات صحيحة' };
    return { stationId: row.stationId };
  }

  const [row] = await db
    .select({ stationId: feeders.stationId, segmentType: feederSegments.segmentType })
    .from(feederSegments)
    .innerJoin(feeders, eq(feederSegments.feederId, feeders.id))
    .where(eq(feederSegments.id, targetId))
    .limit(1);
  if (!row) return null;
  if (targetType === 'main_segment' && row.segmentType !== 'main') return { stationId: row.stationId, error: 'اختر موصلاً رئيسياً صحيحاً' };
  if (targetType === 'branch_segment' && row.segmentType !== 'branch') return { stationId: row.stationId, error: 'اختر تفريعة صحيحة' };
  return { stationId: row.stationId };
}

app.get('/monitoring-meters', async (c) => {
  const auth = c.get('auth');
  const stationId = c.req.query('stationId');
  const targetType = c.req.query('targetType') as MonitoringTargetType | undefined;
  const conditions: SQL[] = [];
  const scope = stationScopeCondition(auth, monitoringMeters.stationId, stationId);
  if (scope) conditions.push(scope);
  if (targetType && monitoringTargetTypeValues.includes(targetType)) {
    conditions.push(eq(monitoringMeters.targetType, targetType));
  }

  const rows = await db
    .select({
      id: monitoringMeters.id,
      stationId: monitoringMeters.stationId,
      stationName: stations.name,
      name: monitoringMeters.name,
      code: monitoringMeters.code,
      targetType: monitoringMeters.targetType,
      targetId: monitoringMeters.targetId,
      kind: monitoringMeters.kind,
      lastVoltage: monitoringMeters.lastVoltage,
      lastCurrent: monitoringMeters.lastCurrent,
      lastKwh: monitoringMeters.lastKwh,
      lastPowerKw: monitoringMeters.lastPowerKw,
      loadPercent: monitoringMeters.loadPercent,
      status: monitoringMeters.status,
      lastReadAt: monitoringMeters.lastReadAt,
      notes: monitoringMeters.notes,
      createdAt: monitoringMeters.createdAt,
    })
    .from(monitoringMeters)
    .leftJoin(stations, eq(monitoringMeters.stationId, stations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(monitoringMeters.targetType, monitoringMeters.name);

  return c.json(rows);
});

app.post('/monitoring-meters', async (c) => {
  const parsed = monitoringMeterSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات عداد الرصد غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const denied = requireStationAccess(c, data.stationId);
  if (denied) return denied;

  if (data.targetId) {
    const target = await resolveMonitoringTargetStation(data.targetType, data.targetId);
    if (!target) return c.json({ error: 'مكان عداد الرصد غير موجود' }, 404);
    if ('error' in target) return c.json({ error: target.error }, 400);
    if (target.stationId !== data.stationId) return c.json({ error: 'مكان عداد الرصد يجب أن يكون من نفس المحطة' }, 400);
  }

  const hasReading = data.lastVoltage != null || data.lastCurrent != null || data.lastKwh != null || data.lastPowerKw != null || data.loadPercent != null;
  const [created] = await db.insert(monitoringMeters).values({
    stationId: data.stationId,
    name: data.name,
    code: data.code ?? null,
    targetType: data.targetType,
    targetId: data.targetId ?? null,
    kind: data.kind ?? 'load',
    lastVoltage: data.lastVoltage != null ? data.lastVoltage.toString() : null,
    lastCurrent: data.lastCurrent != null ? data.lastCurrent.toString() : null,
    lastKwh: data.lastKwh != null ? data.lastKwh.toString() : null,
    lastPowerKw: data.lastPowerKw != null ? data.lastPowerKw.toString() : null,
    loadPercent: data.loadPercent ?? null,
    status: data.status ?? 'active',
    lastReadAt: parseDate(data.lastReadAt) ?? (hasReading ? new Date() : null),
    notes: data.notes ?? null,
  }).returning();

  await recordAudit({ userId: c.get('auth').user.id, action: 'monitoring_meter_create', entityType: 'monitoring_meters', entityId: created.id, metadata: data });
  return c.json(created, 201);
});

app.put('/monitoring-meters/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(monitoringMeters).where(eq(monitoringMeters.id, id)).limit(1);
  if (!current) return c.json({ error: 'عداد الرصد غير موجود' }, 404);

  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  const parsed = monitoringMeterSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات عداد الرصد غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;
  const targetStationId = data.stationId ?? current.stationId;
  const targetType = (data.targetType ?? current.targetType) as MonitoringTargetType;
  const targetId = data.targetId !== undefined ? data.targetId : current.targetId;

  const targetDenied = requireStationAccess(c, targetStationId);
  if (targetDenied) return targetDenied;

  if (targetId) {
    const target = await resolveMonitoringTargetStation(targetType, targetId);
    if (!target) return c.json({ error: 'مكان عداد الرصد غير موجود' }, 404);
    if ('error' in target) return c.json({ error: target.error }, 400);
    if (target.stationId !== targetStationId) return c.json({ error: 'مكان عداد الرصد يجب أن يكون من نفس المحطة' }, 400);
  }

  const updateData: Record<string, unknown> = {};
  if (data.stationId !== undefined) updateData.stationId = data.stationId;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.targetType !== undefined) updateData.targetType = data.targetType;
  if (data.targetId !== undefined) updateData.targetId = data.targetId;
  if (data.kind !== undefined) updateData.kind = data.kind;
  if (data.lastVoltage !== undefined) updateData.lastVoltage = data.lastVoltage != null ? data.lastVoltage.toString() : null;
  if (data.lastCurrent !== undefined) updateData.lastCurrent = data.lastCurrent != null ? data.lastCurrent.toString() : null;
  if (data.lastKwh !== undefined) updateData.lastKwh = data.lastKwh != null ? data.lastKwh.toString() : null;
  if (data.lastPowerKw !== undefined) updateData.lastPowerKw = data.lastPowerKw != null ? data.lastPowerKw.toString() : null;
  if (data.loadPercent !== undefined) updateData.loadPercent = data.loadPercent;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.lastReadAt !== undefined) updateData.lastReadAt = parseDate(data.lastReadAt);
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.lastReadAt === undefined && (
    data.lastVoltage !== undefined ||
    data.lastCurrent !== undefined ||
    data.lastKwh !== undefined ||
    data.lastPowerKw !== undefined ||
    data.loadPercent !== undefined
  )) {
    updateData.lastReadAt = new Date();
  }

  const [updated] = await db.update(monitoringMeters).set(updateData).where(eq(monitoringMeters.id, id)).returning();
  await recordAudit({ userId: c.get('auth').user.id, action: 'monitoring_meter_update', entityType: 'monitoring_meters', entityId: id, metadata: updateData });
  return c.json(updated);
});

app.delete('/monitoring-meters/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(monitoringMeters).where(eq(monitoringMeters.id, id)).limit(1);
  if (!current) return c.json({ error: 'عداد الرصد غير موجود' }, 404);

  const denied = requireStationAccess(c, current.stationId);
  if (denied) return denied;

  await db.delete(monitoringMeters).where(eq(monitoringMeters.id, id));
  await recordAudit({ userId: c.get('auth').user.id, action: 'monitoring_meter_delete', entityType: 'monitoring_meters', entityId: id, metadata: { name: current.name } });
  return c.json({ success: true });
});

export default app;
