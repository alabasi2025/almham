import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { and, asc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, sessions, employees, stations } from '../db/schema.js';
import { verifyPassword, hashPassword } from '../lib/password.js';
import { generateTokenId, signToken } from '../lib/jwt.js';
import { recordAudit } from '../lib/audit.js';
import { requireAuth, getAuthCookieName } from '../middleware/auth.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1).max(128),
  client: z.enum(['web', 'mobile']).optional().default('web'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const SESSION_HOURS = 12;
const COOKIE_NAME = getAuthCookieName();
const COOKIE_PATH = process.env['SESSION_COOKIE_PATH'] ?? '/';
const COOKIE_DOMAIN = process.env['SESSION_COOKIE_DOMAIN']?.trim() || undefined;
const COOKIE_SAME_SITE = readSameSite('SESSION_COOKIE_SAME_SITE', 'Lax');
const COOKIE_SECURE = readBoolean('SESSION_COOKIE_SECURE', process.env['NODE_ENV'] === 'production') || COOKIE_SAME_SITE === 'None';
const LOGIN_WINDOW_MS = readPositiveNumber('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const LOGIN_MAX_FAILED = readPositiveNumber('LOGIN_RATE_LIMIT_MAX_FAILED', 5);
const LOGIN_BLOCK_MS = readPositiveNumber('LOGIN_RATE_LIMIT_BLOCK_MS', 15 * 60 * 1000);
const LOGIN_ATTEMPT_MAX_KEYS = readPositiveNumber('LOGIN_RATE_LIMIT_MAX_KEYS', 2000);

interface LoginAttempt {
  count: number;
  firstFailedAt: number;
  blockedUntil: number | null;
  lastSeenAt: number;
}

const failedLoginAttempts = new Map<string, LoginAttempt>();

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function readSameSite(name: string, fallback: 'Strict' | 'Lax' | 'None'): 'Strict' | 'Lax' | 'None' {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === 'strict') return 'Strict';
  if (raw === 'lax') return 'Lax';
  if (raw === 'none') return 'None';
  return fallback;
}

function getClientIp(c: Context): string | null {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    null
  );
}

function getLoginAttemptKey(ip: string | null, username: string): string {
  return `${ip ?? 'unknown'}:${username.trim().toLowerCase()}`;
}

function pruneLoginAttempts(now = Date.now()) {
  const maxAge = Math.max(LOGIN_WINDOW_MS, LOGIN_BLOCK_MS) * 2;

  for (const [key, entry] of failedLoginAttempts) {
    if (now - entry.lastSeenAt > maxAge) {
      failedLoginAttempts.delete(key);
    }
  }

  while (failedLoginAttempts.size > LOGIN_ATTEMPT_MAX_KEYS) {
    const oldest = failedLoginAttempts.keys().next().value;
    if (!oldest) break;
    failedLoginAttempts.delete(oldest);
  }
}

function getLoginBlock(key: string): number | null {
  const now = Date.now();
  const entry = failedLoginAttempts.get(key);
  if (!entry) return null;

  if (entry.blockedUntil && entry.blockedUntil > now) {
    entry.lastSeenAt = now;
    return Math.ceil((entry.blockedUntil - now) / 1000);
  }

  if ((entry.blockedUntil && entry.blockedUntil <= now) || now - entry.firstFailedAt > LOGIN_WINDOW_MS) {
    failedLoginAttempts.delete(key);
  }

  return null;
}

function recordFailedLogin(key: string): number | null {
  const now = Date.now();
  pruneLoginAttempts(now);

  const existing = failedLoginAttempts.get(key);
  const entry =
    existing && now - existing.firstFailedAt <= LOGIN_WINDOW_MS
      ? existing
      : { count: 0, firstFailedAt: now, blockedUntil: null, lastSeenAt: now };

  entry.count += 1;
  entry.lastSeenAt = now;

  if (entry.count >= LOGIN_MAX_FAILED) {
    entry.blockedUntil = now + LOGIN_BLOCK_MS;
    failedLoginAttempts.set(key, entry);
    return Math.ceil(LOGIN_BLOCK_MS / 1000);
  }

  failedLoginAttempts.set(key, entry);
  return null;
}

function clearFailedLogin(key: string) {
  failedLoginAttempts.delete(key);
}

function rateLimitResponse(c: Context, retryAfterSeconds: number) {
  c.header('Retry-After', String(retryAfterSeconds));
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return c.json({ error: `تم إيقاف محاولات الدخول مؤقتاً. حاول بعد ${minutes} دقيقة` }, 429);
}

// GET /api/auth/stations-for-login — قائمة المحطات
app.get('/stations-for-login', async (c) => {
  const rows = await db
    .select({ id: stations.id, name: stations.name })
    .from(stations)
    .orderBy(asc(stations.name));
  return c.json(rows);
});

// GET /api/auth/users-for-login?stationId=<station_id>
app.get('/users-for-login', async (c) => {
  const stationId = c.req.query('stationId');

  let whereClause;
  if (stationId) {
    whereClause = and(
      eq(users.isActive, true),
      or(
        eq(users.role, 'admin'),
        eq(users.role, 'accountant'),
        eq(users.stationId, stationId),
      ),
    );
  } else {
    whereClause = eq(users.isActive, true);
  }

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      stationId: users.stationId,
      employeeName: employees.name,
    })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(whereClause)
    .orderBy(asc(users.username));

  return c.json(rows);
});

// POST /api/auth/login
app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'اسم المستخدم وكلمة السر مطلوبان' }, 400);
  }

  const { username, password, client } = parsed.data;
  const ip = getClientIp(c);
  const normalizedUsername = username.trim().toLowerCase();
  const rateLimitKey = getLoginAttemptKey(ip, normalizedUsername);
  const activeBlock = getLoginBlock(rateLimitKey);
  if (activeBlock) {
    return rateLimitResponse(c, activeBlock);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (!user || !user.isActive) {
    const retryAfter = recordFailedLogin(rateLimitKey);
    await recordAudit({ action: 'auth.login.failed', metadata: { username: normalizedUsername, reason: 'not_found_or_inactive' }, ipAddress: ip });
    if (retryAfter) return rateLimitResponse(c, retryAfter);
    return c.json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' }, 401);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const retryAfter = recordFailedLogin(rateLimitKey);
    await recordAudit({ userId: user.id, action: 'auth.login.failed', metadata: { reason: 'bad_password' }, ipAddress: ip });
    if (retryAfter) return rateLimitResponse(c, retryAfter);
    return c.json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' }, 401);
  }

  clearFailedLogin(rateLimitKey);

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
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    path: COOKIE_PATH,
    domain: COOKIE_DOMAIN,
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
    token: client === 'mobile' ? token : undefined,
    expiresAt: client === 'mobile' ? expiresAt.toISOString() : undefined,
  });
});

// POST /api/auth/logout
app.post('/logout', requireAuth, async (c) => {
  const auth = c.get('auth');
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenId, auth.tokenId));
  await recordAudit({ userId: auth.user.id, action: 'auth.logout', ipAddress: getClientIp(c) });
  deleteCookie(c, COOKIE_NAME, { path: COOKIE_PATH, domain: COOKIE_DOMAIN });
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
