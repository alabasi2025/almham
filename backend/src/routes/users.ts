import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, employees, stations } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { recordAudit } from '../lib/audit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

// GET /api/users — قائمة كل المستخدمين (admin + accountant)
app.get('/', requireRole('admin', 'accountant'), async (c) => {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      employeeId: users.employeeId,
      employeeName: employees.name,
      employeeRole: employees.role,
      stationId: users.stationId,
      stationName: stations.name,
    })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(stations, eq(users.stationId, stations.id))
    .orderBy(users.createdAt);
  return c.json(rows);
});

// POST /api/users/:id/toggle-active — تفعيل/تعطيل حساب
app.post('/:id/toggle-active', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف مستخدم مطلوب' }, 400);
  const auth = c.get('auth');
  if (id === auth.user.id) {
    return c.json({ error: 'لا يمكنك تعطيل حسابك الخاص' }, 400);
  }
  const [current] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, id)).limit(1);
  if (!current) return c.json({ error: 'المستخدم غير موجود' }, 404);

  const [updated] = await db
    .update(users)
    .set({ isActive: !current.isActive })
    .where(eq(users.id, id))
    .returning({ id: users.id, username: users.username, isActive: users.isActive });

  await recordAudit({
    userId: auth.user.id,
    action: updated.isActive ? 'user.activate' : 'user.deactivate',
    entityType: 'user',
    entityId: id,
  });

  return c.json(updated);
});

// POST /api/users/:id/reset-password — إعادة تعيين كلمة السر
const resetSchema = z.object({ newPassword: z.string().min(8).max(128) });

app.post('/:id/reset-password', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف مستخدم مطلوب' }, 400);
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'كلمة السر الجديدة يجب أن تكون 8 أحرف على الأقل' }, 400);
  }

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!exists) return c.json({ error: 'المستخدم غير موجود' }, 404);

  const newHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, mustChangePassword: true })
    .where(eq(users.id, id));

  await recordAudit({
    userId: auth.user.id,
    action: 'user.reset_password',
    entityType: 'user',
    entityId: id,
  });

  return c.json({ success: true });
});

// POST /api/users/:id/change-role — تغيير دور المستخدم
const roleSchema = z.object({
  role: z.enum(['admin', 'accountant', 'station_manager', 'technician', 'cashier']),
  stationId: z.string().uuid().nullable().optional(),
});

app.post('/:id/change-role', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'معرّف مستخدم مطلوب' }, 400);
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة' }, 400);

  const [updated] = await db
    .update(users)
    .set({ role: parsed.data.role, stationId: parsed.data.stationId ?? null })
    .where(eq(users.id, id))
    .returning({ id: users.id, role: users.role, stationId: users.stationId });

  if (!updated) return c.json({ error: 'المستخدم غير موجود' }, 404);

  await recordAudit({
    userId: auth.user.id,
    action: 'user.change_role',
    entityType: 'user',
    entityId: id,
    metadata: { newRole: parsed.data.role, stationId: parsed.data.stationId },
  });

  return c.json(updated);
});

export default app;
