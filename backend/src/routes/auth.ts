import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { verifyPassword, hashPassword } from '../lib/password.js';
import { generateTokenId, signToken } from '../lib/jwt.js';
import { recordAudit } from '../lib/audit.js';
import { requireAuth, getAuthCookieName } from '../middleware/auth.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const SESSION_HOURS = 12;
const COOKIE_NAME = getAuthCookieName();

function getClientIp(c: import('hono').Context): string | null {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    null
  );
}

// POST /api/auth/login
app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'اسم المستخدم وكلمة السر مطلوبان' }, 400);
  }

  const { username, password } = parsed.data;
  const ip = getClientIp(c);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (!user || !user.isActive) {
    await recordAudit({ action: 'auth.login.failed', metadata: { username, reason: 'not_found_or_inactive' }, ipAddress: ip });
    return c.json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' }, 401);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordAudit({ userId: user.id, action: 'auth.login.failed', metadata: { reason: 'bad_password' }, ipAddress: ip });
    return c.json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' }, 401);
  }

  const tokenId = generateTokenId();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const token = signToken({
    sub: user.id,
    tid: tokenId,
    role: user.role,
    username: user.username,
  });

  await db.insert(sessions).values({
    userId: user.id,
    tokenId,
    userAgent: c.req.header('user-agent') ?? null,
    ipAddress: ip,
    expiresAt,
  });

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  await recordAudit({ userId: user.id, action: 'auth.login.success', ipAddress: ip });

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false, // TODO: true when behind HTTPS
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60,
  });

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employeeId,
      stationId: user.stationId,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// POST /api/auth/logout
app.post('/logout', requireAuth, async (c) => {
  const auth = c.get('auth');
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenId, auth.tokenId));
  await recordAudit({ userId: auth.user.id, action: 'auth.logout', ipAddress: getClientIp(c) });
  deleteCookie(c, COOKIE_NAME, { path: '/' });
  return c.json({ success: true });
});

// GET /api/auth/me
app.get('/me', requireAuth, async (c) => {
  const auth = c.get('auth');
  return c.json({ user: auth.user });
});

// POST /api/auth/change-password
app.post('/change-password', requireAuth, async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'كلمة السر الجديدة يجب أن تكون 8 أحرف على الأقل' }, 400);
  }

  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.id, auth.user.id)).limit(1);
  if (!user) return c.json({ error: 'المستخدم غير موجود' }, 404);

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    await recordAudit({ userId: user.id, action: 'auth.change_password.failed', ipAddress: getClientIp(c) });
    return c.json({ error: 'كلمة السر الحالية غير صحيحة' }, 401);
  }

  const newHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(users.id, user.id));

  await recordAudit({ userId: user.id, action: 'auth.change_password.success', ipAddress: getClientIp(c) });

  return c.json({ success: true });
});

export default app;
