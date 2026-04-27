import { Hono } from 'hono';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tasks } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canAccessStation,
  canManageStationData,
  denyAccess,
  requireStationAccess,
  requireStationManagerAccess,
  stationScopeCondition,
} from '../lib/access-control.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const taskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().nullable().optional(),
  type: z.enum(['maintenance', 'inspection', 'repair', 'installation']),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'cancelled']).optional(),
  stationId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

const taskUpdateSchema = taskSchema.partial();

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('invalid-date');
  return date;
}

app.get('/', async (c) => {
  const auth = c.get('auth');
  const requestedStationId = c.req.query('stationId');
  const scope = stationScopeCondition(auth, tasks.stationId, requestedStationId);
  const assigneeScope = auth.user.employeeId ? eq(tasks.employeeId, auth.user.employeeId) : undefined;
  const where = scope && assigneeScope ? or(scope, assigneeScope) : scope ?? assigneeScope;
  const result = await db.select().from(tasks).where(where).orderBy(tasks.createdAt);
  return c.json(result);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const result = await db.select().from(tasks).where(eq(tasks.id, id));
  if (result.length === 0) return c.json({ error: 'المهمة غير موجودة' }, 404);
  const task = result[0];
  if (task.employeeId !== auth.user.employeeId && !canAccessStation(auth.user, task.stationId)) {
    return c.json({ error: 'ليست لديك صلاحية لهذه المهمة' }, 403);
  }
  return c.json(result[0]);
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  if (!canManageStationData(auth.user)) return denyAccess(c);

  const body = await c.req.json().catch(() => null);
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المهمة غير صحيحة' }, 400);

  const data = parsed.data;
  const stationId = data.stationId ?? auth.user.stationId ?? null;
  const denied = requireStationManagerAccess(c, stationId);
  if (denied) return denied;

  let dueDate: Date | null;
  try {
    dueDate = parseOptionalDate(data.dueDate);
  } catch {
    return c.json({ error: 'تاريخ الاستحقاق غير صحيح' }, 400);
  }

  const result = await db.insert(tasks).values({
    title: data.title,
    description: data.description ?? null,
    type: data.type,
    priority: data.priority || 'medium',
    status: data.status || 'pending',
    stationId,
    employeeId: data.employeeId ?? null,
    dueDate,
  }).returning();
  return c.json(result[0], 201);
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const [current] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!current) return c.json({ error: 'المهمة غير موجودة' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات المهمة غير صحيحة' }, 400);

  const data = parsed.data;
  const statusOnlyUpdate = Object.keys(data).every((key) => key === 'status');
  const assignedToCurrentUser = current.employeeId === auth.user.employeeId;
  if (statusOnlyUpdate && assignedToCurrentUser) {
    const stationDenied = requireStationAccess(c, current.stationId);
    if (stationDenied) return stationDenied;
  } else {
    const denied = requireStationManagerAccess(c, current.stationId);
    if (denied) return denied;
  }
  if (data.stationId !== undefined) {
    const stationDenied = requireStationManagerAccess(c, data.stationId);
    if (stationDenied) return stationDenied;
  }

  const update: Record<string, unknown> = { ...data };
  if (data.dueDate !== undefined) {
    try {
      update['dueDate'] = parseOptionalDate(data.dueDate);
    } catch {
      return c.json({ error: 'تاريخ الاستحقاق غير صحيح' }, 400);
    }
  }
  if (Object.keys(update).length === 0) return c.json({ error: 'لا توجد بيانات للتعديل' }, 400);

  const result = await db.update(tasks).set(update).where(eq(tasks.id, id)).returning();
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [current] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!current) return c.json({ error: 'المهمة غير موجودة' }, 404);
  const denied = requireStationManagerAccess(c, current.stationId);
  if (denied) return denied;

  const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  return c.json({ message: 'تم حذف المهمة بنجاح' });
});

export default app;
