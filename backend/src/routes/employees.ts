import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { employees } from '../db/schema.js';

const app = new Hono();

app.get('/', async (c) => {
  const result = await db.select().from(employees).orderBy(employees.createdAt);
  return c.json(result);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.select().from(employees).where(eq(employees.id, id));
  if (result.length === 0) return c.json({ error: 'الموظف غير موجود' }, 404);
  return c.json(result[0]);
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = await db.insert(employees).values({
    name: body.name,
    role: body.role,
    phone: body.phone,
    email: body.email,
    stationId: body.stationId,
    status: body.status || 'active',
  }).returning();
  return c.json(result[0], 201);
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = await db.update(employees).set(body).where(eq(employees.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'الموظف غير موجود' }, 404);
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.delete(employees).where(eq(employees.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'الموظف غير موجود' }, 404);
  return c.json({ message: 'تم حذف الموظف بنجاح' });
});

export default app;
