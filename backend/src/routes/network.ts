import { Hono } from 'hono';
import { eq, and, sql, SQL } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '../db/index.js';
import { feeders, panels, stations, employees } from '../db/schema.js';
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

// ==================== PANELS ====================

const panelSchema = z.object({
  stationId: z.string().uuid(),
  feederId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  code: z.string().max(64).nullable().optional(),
  type: z.enum(['sync', 'main_distribution', 'meter_box']).optional(),
  controllerType: z.string().max(128).nullable().optional(),
  capacityAmps: z.number().int().positive().nullable().optional(),
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
      poleNumber: panels.poleNumber,
      maxSlots: panels.maxSlots,
      latitude: panels.latitude,
      longitude: panels.longitude,
      status: panels.status,
      notes: panels.notes,
      createdAt: panels.createdAt,
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
    feederId: data.feederId ?? null,
    name: data.name,
    code: data.code ?? null,
    type: data.type ?? 'meter_box',
    controllerType: data.controllerType ?? null,
    capacityAmps: data.capacityAmps ?? null,
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
  if (body.poleNumber !== undefined) updateData.poleNumber = body.poleNumber;
  if (body.maxSlots !== undefined) updateData.maxSlots = body.maxSlots;
  if (body.latitude !== undefined) updateData.latitude = body.latitude?.toString() ?? null;
  if (body.longitude !== undefined) updateData.longitude = body.longitude?.toString() ?? null;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;

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

export default app;
