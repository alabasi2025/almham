import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tasks } from '../db/schema.js';

const app = new Hono();

app.get('/', async (c) => {
  const result = await db.select().from(tasks).orderBy(tasks.createdAt);
  return c.json(result);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.select().from(tasks).where(eq(tasks.id, id));
  if (result.length === 0) return c.json({ error: 'المهمة غير موجودة' }, 404);
  return c.json(result[0]);
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = await db.insert(tasks).values({
    title: body.title,
    description: body.description,
    type: body.type,
    priority: body.priority || 'medium',
    status: body.status || 'pending',
    stationId: body.stationId,
    employeeId: body.employeeId,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  }).returning();
  return c.json(result[0], 201);
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (body.dueDate) body.dueDate = new Date(body.dueDate);
  const result = await db.update(tasks).set(body).where(eq(tasks.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'المهمة غير موجودة' }, 404);
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'المهمة غير موجودة' }, 404);
  return c.json({ message: 'تم حذف المهمة بنجاح' });
});

export default app;
