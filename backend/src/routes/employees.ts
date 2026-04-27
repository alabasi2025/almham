import { Hono } from 'hono';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { employees } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canAccessStation,
  canManageStationData,
  denyAccess,
  requireStationManagerAccess,
  stationScopeCondition,
} from '../lib/access-control.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const employeeSchema = z.object({
  name: z.string().trim().min(1).max(255),
  role: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(20),
  email: z.string().trim().min(1).max(255),
  stationId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const employeeUpdateSchema = employeeSchema.partial();

app.get('/', async (c) => {
  const auth = c.get('auth');
  const scope = stationScopeCondition(auth, employees.stationId);
  const selfScope = auth.user.employeeId ? eq(employees.id, auth.user.employeeId) : undefined;
  const where = scope && selfScope ? or(scope, selfScope) : scope ?? selfScope;
  const result = await db.select().from(employees).where(where).orderBy(employees.createdAt);
  return c.json(result);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const result = await db.select().from(employees).where(eq(employees.id, id));
  if (result.length === 0) return c.json({ error: 'الموظف غير موجود' }, 404);
  const employee = result[0];
  if (employee.id !== auth.user.employeeId && !canAccessStation(auth.user, employee.stationId)) {
    return c.json({ error: 'ليست لديك صلاحية لهذا الموظف' }, 403);
  }
  return c.json(result[0]);
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  if (!canManageStationData(auth.user)) return denyAccess(c);

  const body = await c.req.json().catch(() => null);
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الموظف غير صحيحة' }, 400);
  const data = parsed.data;
  const stationId = data.stationId ?? auth.user.stationId ?? null;
  const denied = requireStationManagerAccess(c, stationId);
  if (denied) return denied;

  const result = await db.insert(employees).values({
    name: data.name,
    role: data.role,
    phone: data.phone,
    email: data.email,
    stationId,
    status: data.status || 'active',
  }).returning();
  return c.json(result[0], 201);
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (!current) return c.json({ error: 'الموظف غير موجود' }, 404);
  const denied = requireStationManagerAccess(c, current.stationId);
  if (denied) return denied;

  const body = await c.req.json().catch(() => null);
  const parsed = employeeUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات الموظف غير صحيحة' }, 400);
  if (Object.keys(parsed.data).length === 0) return c.json({ error: 'لا توجد بيانات للتعديل' }, 400);
  if (parsed.data.stationId !== undefined) {
    const stationDenied = requireStationManagerAccess(c, parsed.data.stationId);
    if (stationDenied) return stationDenied;
  }

  const result = await db.update(employees).set(parsed.data).where(eq(employees.id, id)).returning();
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (!current) return c.json({ error: 'الموظف غير موجود' }, 404);
  const denied = requireStationManagerAccess(c, current.stationId);
  if (denied) return denied;

  const result = await db.delete(employees).where(eq(employees.id, id)).returning();
  return c.json({ message: 'تم حذف الموظف بنجاح' });
});

export default app;
