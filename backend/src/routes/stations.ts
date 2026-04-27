import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { stations } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canAccessStation,
  hasGlobalAccess,
  requireGlobalAccess,
  requireStationManagerAccess,
  stationScopeCondition,
} from '../lib/access-control.js';
import { recordAudit } from '../lib/audit.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const coordinateSchema = z
  .union([
    z.number().finite(),
    z.string().trim().refine((value) => value === '' || Number.isFinite(Number(value))),
  ])
  .nullable();

const stationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  location: z.string().trim().min(1).max(500),
  capacity: z.coerce.number().int().min(0).default(0),
  type: z.string().trim().min(1).max(100),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  latitude: coordinateSchema.optional(),
  longitude: coordinateSchema.optional(),
});

const stationUpdateSchema = stationSchema.partial();

function normalizeCoordinate(value: z.infer<typeof coordinateSchema> | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return String(value);
}

app.get('/', async (c) => {
  const auth = c.get('auth');
  const scope = stationScopeCondition(auth, stations.id);
  const result = await db.select().from(stations).where(scope).orderBy(stations.createdAt);
  return c.json(result);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const result = await db.select().from(stations).where(eq(stations.id, id));
  if (result.length === 0) return c.json({ error: 'المحطة غير موجودة' }, 404);
  if (!canAccessStation(auth.user, result[0].id)) {
    return c.json({ error: 'ليست لديك صلاحية لهذه المحطة' }, 403);
  }
  return c.json(result[0]);
});

app.post('/', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;
  const auth = c.get('auth');

  const body = await c.req.json().catch(() => null);
  const parsed = stationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المحطة غير صحيحة' }, 400);
  const data = parsed.data;

  const result = await db.insert(stations).values({
    name: data.name,
    location: data.location,
    capacity: data.capacity,
    type: data.type,
    status: data.status || 'active',
    latitude: normalizeCoordinate(data.latitude) ?? null,
    longitude: normalizeCoordinate(data.longitude) ?? null,
  }).returning();

  await recordAudit({
    userId: auth.user.id,
    action: 'station.create',
    entityType: 'station',
    entityId: result[0].id,
    metadata: { name: result[0].name, location: result[0].location },
  });

  return c.json(result[0], 201);
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(stations).where(eq(stations.id, id)).limit(1);
  if (!current) return c.json({ error: 'المحطة غير موجودة' }, 404);
  const denied = requireStationManagerAccess(c, current.id);
  if (denied) return denied;

  const body = await c.req.json().catch(() => null);
  const parsed = stationUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المحطة غير صحيحة' }, 400);

  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update['name'] = data.name;
  if (data.location !== undefined) update['location'] = data.location;
  if (data.capacity !== undefined) update['capacity'] = data.capacity;
  if (data.type !== undefined) update['type'] = data.type;
  if (data.status !== undefined) update['status'] = data.status;
  if (data.latitude !== undefined) update['latitude'] = normalizeCoordinate(data.latitude) ?? null;
  if (data.longitude !== undefined) update['longitude'] = normalizeCoordinate(data.longitude) ?? null;
  if (Object.keys(update).length === 0) return c.json({ error: 'لا توجد بيانات للتعديل' }, 400);

  const auth = c.get('auth');
  if (!hasGlobalAccess(auth.user)) {
    delete update['capacity'];
    delete update['status'];
  }

  const result = await db.update(stations).set(update).where(eq(stations.id, id)).returning();
  await recordAudit({
    userId: auth.user.id,
    action: 'station.update',
    entityType: 'station',
    entityId: id,
    metadata: {
      changedFields: Object.keys(update),
      locationChanged: update['latitude'] !== undefined || update['longitude'] !== undefined,
    },
  });
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  const auth = c.get('auth');
  const result = await db.delete(stations).where(eq(stations.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'المحطة غير موجودة' }, 404);
  await recordAudit({
    userId: auth.user.id,
    action: 'station.delete',
    entityType: 'station',
    entityId: id,
    metadata: { name: result[0].name, location: result[0].location },
  });
  return c.json({ message: 'تم حذف المحطة بنجاح' });
});

export default app;
