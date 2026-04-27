import type { Context } from 'hono';
import { eq, sql, type SQL } from 'drizzle-orm';
import type { AuthContext, AuthUser } from '../middleware/auth.js';
import type { HonoEnv } from './hono-env.js';

const GLOBAL_ACCESS_ROLES = new Set(['admin', 'accountant']);
const STATION_MANAGER_ROLES = new Set(['station_manager']);

export function hasGlobalAccess(user: AuthUser): boolean {
  return GLOBAL_ACCESS_ROLES.has(user.role);
}

export function canManageStationData(user: AuthUser): boolean {
  return hasGlobalAccess(user) || STATION_MANAGER_ROLES.has(user.role);
}

export function canAccessStation(user: AuthUser, stationId: string | null | undefined): boolean {
  if (hasGlobalAccess(user)) return true;
  return !!stationId && stationId === user.stationId;
}

export function denyAccess(c: Context<HonoEnv>): Response {
  return c.json({ error: 'ليست لديك صلاحية لهذا الإجراء' }, 403);
}

export function denyStationAccess(c: Context<HonoEnv>): Response {
  return c.json({ error: 'ليست لديك صلاحية لهذه المحطة' }, 403);
}

export function requireStationAccess(
  c: Context<HonoEnv>,
  stationId: string | null | undefined,
): Response | null {
  const auth = c.get('auth');
  return canAccessStation(auth.user, stationId) ? null : denyStationAccess(c);
}

export function requireStationManagerAccess(
  c: Context<HonoEnv>,
  stationId: string | null | undefined,
): Response | null {
  const auth = c.get('auth');
  if (!canManageStationData(auth.user)) return denyAccess(c);
  return canAccessStation(auth.user, stationId) ? null : denyStationAccess(c);
}

export function requireGlobalAccess(c: Context<HonoEnv>): Response | null {
  const auth = c.get('auth');
  return hasGlobalAccess(auth.user) ? null : denyAccess(c);
}

export function stationScopeCondition(
  auth: AuthContext,
  column: Parameters<typeof eq>[0],
  requestedStationId?: string | null,
): SQL | undefined {
  if (hasGlobalAccess(auth.user)) {
    return requestedStationId ? eq(column, requestedStationId) : undefined;
  }

  if (!auth.user.stationId) return sql`false`;
  if (requestedStationId && requestedStationId !== auth.user.stationId) return sql`false`;
  return eq(column, auth.user.stationId);
}

export function effectiveStationId(auth: AuthContext, requestedStationId?: string | null): string | null {
  if (hasGlobalAccess(auth.user)) return requestedStationId ?? null;
  return auth.user.stationId ?? null;
}
