import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stations } from '../db/schema.js';

const app = new Hono();

app.get('/', async (c) => {
  const result = await db.select().from(stations).orderBy(stations.createdAt);
  return c.json(result);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.select().from(stations).where(eq(stations.id, id));
  if (result.length === 0) return c.json({ error: 'المحطة غير موجودة' }, 404);
  return c.json(result[0]);
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = await db.insert(stations).values({
    name: body.name,
    location: body.location,
    capacity: body.capacity,
    type: body.type,
    status: body.status || 'active',
    latitude: body.latitude != null ? String(body.latitude) : null,
    longitude: body.longitude != null ? String(body.longitude) : null,
  }).returning();
  return c.json(result[0], 201);
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const update: Record<string, unknown> = { ...body };
  if (body.latitude !== undefined) update['latitude'] = body.latitude != null ? String(body.latitude) : null;
  if (body.longitude !== undefined) update['longitude'] = body.longitude != null ? String(body.longitude) : null;
  const result = await db.update(stations).set(update).where(eq(stations.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'المحطة غير موجودة' }, 404);
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.delete(stations).where(eq(stations.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'المحطة غير موجودة' }, 404);
  return c.json({ message: 'تم حذف المحطة بنجاح' });
});

export default app;
