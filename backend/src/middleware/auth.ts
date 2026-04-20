import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import type { HonoEnv } from '../lib/hono-env.js';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  employeeId: string | null;
  stationId: string | null;
  mustChangePassword: boolean;
}

export interface AuthContext {
  user: AuthUser;
  tokenId: string;
}

const COOKIE_NAME = process.env['SESSION_COOKIE_NAME'] ?? 'almham_session';

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

export async function requireAuth(c: Context<HonoEnv>, next: Next) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: 'يجب تسجيل الدخول' }, 401);
  }

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return c.json({ error: 'الجلسة غير صالحة أو منتهية' }, 401);
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenId, payload.tid),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    return c.json({ error: 'الجلسة منتهية، الرجاء تسجيل الدخول مجدّداً' }, 401);
  }

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      employeeId: users.employeeId,
      stationId: users.stationId,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) {
    return c.json({ error: 'الحساب غير مفعّل' }, 401);
  }

  c.set('auth', {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employeeId,
      stationId: user.stationId,
      mustChangePassword: user.mustChangePassword,
    },
    tokenId: payload.tid,
  } satisfies AuthContext);

  await next();
}

export function requireRole(...allowed: string[]) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'يجب تسجيل الدخول' }, 401);
    }
    if (!allowed.includes(auth.user.role)) {
      return c.json({ error: 'ليست لديك صلاحية لهذا الإجراء' }, 403);
    }
    await next();
  };
}
