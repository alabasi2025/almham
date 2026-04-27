import { Hono, type Context } from 'hono';
import { and, count, desc, eq, gte, inArray, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  attendanceEvents,
  employees,
  locationPoints,
  stationAttendanceSettings,
  stations,
  workSessions,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { stationScopeCondition } from '../lib/access-control.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const locationPayload = z.object({
  clientSessionId: z.string().min(8).max(128),
  clientEventId: z.string().min(8).max(128),
  stationId: z.string().uuid().optional(),
  recordedAt: z.string().datetime().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional().nullable(),
});

const locationPointPayload = z.object({
  clientPointId: z.string().min(8).max(128),
  clientSessionId: z.string().min(8).max(128),
  recordedAt: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional().nullable(),
  speedMetersPerSecond: z.number().optional().nullable(),
  headingDegrees: z.number().optional().nullable(),
  batteryLevel: z.number().min(0).max(1).optional().nullable(),
  isOffline: z.boolean().optional().default(false),
});

const batchLocationPayload = z.object({
  points: z.array(locationPointPayload).max(500),
});

interface MobileEmployeeContext {
  userId: string;
  employee: typeof employees.$inferSelect;
}

interface AttendanceSettings {
  radiusMeters: number;
  trackingIntervalSeconds: number;
  requireGps: boolean;
  requireBiometric: boolean;
}

async function getMobileEmployeeContext(c: Context<HonoEnv>): Promise<MobileEmployeeContext | Response> {
  const auth = c.get('auth');
  if (!auth.user.employeeId) {
    return c.json({ error: 'هذا الحساب غير مربوط بموظف' }, 403);
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, auth.user.employeeId))
    .limit(1);

  if (!employee || employee.status !== 'active') {
    return c.json({ error: 'الموظف غير موجود أو غير مفعّل' }, 403);
  }

  return { userId: auth.user.id, employee };
}

async function getStationForEmployee(employee: typeof employees.$inferSelect, requestedStationId?: string) {
  const stationId = requestedStationId ?? employee.stationId;
  if (!stationId) return null;

  const [station] = await db
    .select()
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);

  return station ?? null;
}

async function getAttendanceSettings(stationId: string): Promise<AttendanceSettings> {
  const [settings] = await db
    .select()
    .from(stationAttendanceSettings)
    .where(eq(stationAttendanceSettings.stationId, stationId))
    .limit(1);

  return {
    radiusMeters: settings?.radiusMeters ?? 100,
    trackingIntervalSeconds: settings?.trackingIntervalSeconds ?? 300,
    requireGps: settings?.requireGps ?? true,
    requireBiometric: settings?.requireBiometric ?? false,
  };
}

function parseDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDbNumber(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return String(value);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function validateStationRange(
  station: typeof stations.$inferSelect,
  settings: AttendanceSettings,
  latitude: number,
  longitude: number,
): { ok: true; distance: number } | { ok: false; distance: number | null; reason: string } {
  if (!settings.requireGps) return { ok: true, distance: 0 };

  const stationLat = toNumber(station.latitude);
  const stationLng = toNumber(station.longitude);
  if (stationLat === null || stationLng === null) {
    return { ok: false, distance: null, reason: 'إحداثيات المحطة غير مكتملة' };
  }

  const distance = Math.round(distanceMeters(latitude, longitude, stationLat, stationLng));
  if (distance > settings.radiusMeters) {
    return { ok: false, distance, reason: `خارج نطاق المحطة (${distance} متر)` };
  }

  return { ok: true, distance };
}

async function getOpenSession(employeeId: string) {
  const [session] = await db
    .select()
    .from(workSessions)
    .where(and(eq(workSessions.employeeId, employeeId), eq(workSessions.status, 'open')))
    .orderBy(desc(workSessions.startedAt))
    .limit(1);

  return session ?? null;
}

app.get('/dashboard', async (c) => {
  const auth = c.get('auth');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionScope = stationScopeCondition(auth, workSessions.stationId);
  const eventScope = stationScopeCondition(auth, attendanceEvents.stationId);
  const settingsScope = stationScopeCondition(auth, stationAttendanceSettings.stationId);

  const openRows = await db
    .select({
      id: workSessions.id,
      clientSessionId: workSessions.clientSessionId,
      status: workSessions.status,
      startedAt: workSessions.startedAt,
      employeeId: employees.id,
      employeeName: employees.name,
      employeeRole: employees.role,
      stationId: stations.id,
      stationName: stations.name,
      stationLocation: stations.location,
      checkInDistanceMeters: workSessions.checkInDistanceMeters,
      checkInAccuracyMeters: workSessions.checkInAccuracyMeters,
    })
    .from(workSessions)
    .innerJoin(employees, eq(workSessions.employeeId, employees.id))
    .innerJoin(stations, eq(workSessions.stationId, stations.id))
    .where(sessionScope ? and(eq(workSessions.status, 'open'), sessionScope) : eq(workSessions.status, 'open'))
    .orderBy(desc(workSessions.startedAt));

  const openSessionIds = openRows.map((row) => row.id);
  const latestPoints =
    openSessionIds.length === 0
      ? []
      : await db
          .select({
            sessionId: locationPoints.sessionId,
            recordedAt: locationPoints.recordedAt,
            latitude: locationPoints.latitude,
            longitude: locationPoints.longitude,
            accuracyMeters: locationPoints.accuracyMeters,
            isOffline: locationPoints.isOffline,
          })
          .from(locationPoints)
          .where(inArray(locationPoints.sessionId, openSessionIds))
          .orderBy(desc(locationPoints.recordedAt))
          .limit(Math.max(openSessionIds.length * 4, 20));

  const latestPointBySession = new Map<string, (typeof latestPoints)[number]>();
  for (const point of latestPoints) {
    if (point.sessionId && !latestPointBySession.has(point.sessionId)) {
      latestPointBySession.set(point.sessionId, point);
    }
  }

  const recentEvents = await db
    .select({
      id: attendanceEvents.id,
      type: attendanceEvents.type,
      source: attendanceEvents.source,
      status: attendanceEvents.status,
      recordedAt: attendanceEvents.recordedAt,
      receivedAt: attendanceEvents.receivedAt,
      distanceMeters: attendanceEvents.distanceMeters,
      rejectionReason: attendanceEvents.rejectionReason,
      employeeName: employees.name,
      stationName: stations.name,
    })
    .from(attendanceEvents)
    .innerJoin(employees, eq(attendanceEvents.employeeId, employees.id))
    .innerJoin(stations, eq(attendanceEvents.stationId, stations.id))
    .where(eventScope)
    .orderBy(desc(attendanceEvents.recordedAt))
    .limit(12);

  const acceptedConditions: SQL[] = [gte(attendanceEvents.recordedAt, today), eq(attendanceEvents.status, 'accepted')];
  if (eventScope) acceptedConditions.push(eventScope);

  const rejectedConditions: SQL[] = [gte(attendanceEvents.recordedAt, today), eq(attendanceEvents.status, 'rejected')];
  if (eventScope) rejectedConditions.push(eventScope);

  const [todayAccepted] = await db
    .select({ value: count() })
    .from(attendanceEvents)
    .where(and(...acceptedConditions));

  const [todayRejected] = await db
    .select({ value: count() })
    .from(attendanceEvents)
    .where(and(...rejectedConditions));

  const settings = await db
    .select({
      stationId: stationAttendanceSettings.stationId,
      radiusMeters: stationAttendanceSettings.radiusMeters,
      trackingIntervalSeconds: stationAttendanceSettings.trackingIntervalSeconds,
      requireGps: stationAttendanceSettings.requireGps,
      requireBiometric: stationAttendanceSettings.requireBiometric,
    })
    .from(stationAttendanceSettings)
    .where(settingsScope);

  return c.json({
    summary: {
      openSessions: openRows.length,
      todayAcceptedEvents: todayAccepted?.value ?? 0,
      todayRejectedEvents: todayRejected?.value ?? 0,
    },
    openSessions: openRows.map((row) => ({
      ...row,
      lastPoint: latestPointBySession.get(row.id) ?? null,
    })),
    recentEvents,
    settings,
  });
});

app.get('/mobile/bootstrap', async (c) => {
  const context = await getMobileEmployeeContext(c);
  if (context instanceof Response) return context;

  const station = await getStationForEmployee(context.employee);
  const settings = station ? await getAttendanceSettings(station.id) : null;
  const openSession = await getOpenSession(context.employee.id);

  return c.json({
    user: c.get('auth').user,
    employee: context.employee,
    station,
    settings,
    openSession,
  });
});

app.get('/open-session', async (c) => {
  const context = await getMobileEmployeeContext(c);
  if (context instanceof Response) return context;

  return c.json({ openSession: await getOpenSession(context.employee.id) });
});

app.post('/check-in', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = locationPayload.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'بيانات الحضور غير صحيحة' }, 400);
  }

  const context = await getMobileEmployeeContext(c);
  if (context instanceof Response) return context;

  const [existingClientSession] = await db
    .select()
    .from(workSessions)
    .where(eq(workSessions.clientSessionId, parsed.data.clientSessionId))
    .limit(1);

  if (existingClientSession) {
    if (existingClientSession.employeeId !== context.employee.id) {
      return c.json({ error: 'هذه الوردية لا تتبع هذا الموظف' }, 403);
    }
    return c.json({ session: existingClientSession, alreadySynced: true });
  }

  const openSession = await getOpenSession(context.employee.id);
  if (openSession) {
    return c.json({ error: 'لديك وردية مفتوحة بالفعل', session: openSession }, 409);
  }

  const station = await getStationForEmployee(context.employee, parsed.data.stationId);
  if (!station) {
    return c.json({ error: 'لا توجد محطة مرتبطة بهذا الموظف' }, 422);
  }

  const settings = await getAttendanceSettings(station.id);
  const range = validateStationRange(station, settings, parsed.data.latitude, parsed.data.longitude);
  const recordedAt = parseDate(parsed.data.recordedAt);

  if (!range.ok) {
    await db.insert(attendanceEvents).values({
      clientEventId: parsed.data.clientEventId,
      userId: context.userId,
      employeeId: context.employee.id,
      stationId: station.id,
      type: 'check_in',
      source: 'mobile',
      status: 'rejected',
      recordedAt,
      latitude: toDbNumber(parsed.data.latitude),
      longitude: toDbNumber(parsed.data.longitude),
      accuracyMeters: parsed.data.accuracyMeters != null ? Math.round(parsed.data.accuracyMeters) : null,
      distanceMeters: range.distance,
      rejectionReason: range.reason,
    }).onConflictDoNothing({ target: attendanceEvents.clientEventId });

    return c.json({ error: range.reason, distanceMeters: range.distance }, 422);
  }

  const [session] = await db.insert(workSessions).values({
    clientSessionId: parsed.data.clientSessionId,
    userId: context.userId,
    employeeId: context.employee.id,
    stationId: station.id,
    status: 'open',
    startedAt: recordedAt,
    checkInLatitude: toDbNumber(parsed.data.latitude),
    checkInLongitude: toDbNumber(parsed.data.longitude),
    checkInAccuracyMeters: parsed.data.accuracyMeters != null ? Math.round(parsed.data.accuracyMeters) : null,
    checkInDistanceMeters: range.distance,
  }).returning();

  await db.insert(attendanceEvents).values({
    clientEventId: parsed.data.clientEventId,
    sessionId: session.id,
    userId: context.userId,
    employeeId: context.employee.id,
    stationId: station.id,
    type: 'check_in',
    source: 'mobile',
    status: 'accepted',
    recordedAt,
    latitude: toDbNumber(parsed.data.latitude),
    longitude: toDbNumber(parsed.data.longitude),
    accuracyMeters: parsed.data.accuracyMeters != null ? Math.round(parsed.data.accuracyMeters) : null,
    distanceMeters: range.distance,
  }).onConflictDoNothing({ target: attendanceEvents.clientEventId });

  return c.json({ session, settings }, 201);
});

app.post('/check-out', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = locationPayload.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'بيانات الانصراف غير صحيحة' }, 400);
  }

  const context = await getMobileEmployeeContext(c);
  if (context instanceof Response) return context;

  const [sessionByClientId] = await db
    .select()
    .from(workSessions)
    .where(eq(workSessions.clientSessionId, parsed.data.clientSessionId))
    .limit(1);
  const session = sessionByClientId ?? await getOpenSession(context.employee.id);

  if (!session) {
    return c.json({ error: 'لا توجد وردية مفتوحة للانصراف' }, 404);
  }

  if (session.employeeId !== context.employee.id) {
    return c.json({ error: 'هذه الوردية لا تتبع هذا الموظف' }, 403);
  }

  if (session.status === 'closed') {
    return c.json({ session, alreadySynced: true });
  }

  const station = await getStationForEmployee(context.employee, session.stationId);
  if (!station) {
    return c.json({ error: 'المحطة غير موجودة' }, 422);
  }

  const settings = await getAttendanceSettings(station.id);
  const range = validateStationRange(station, settings, parsed.data.latitude, parsed.data.longitude);
  const recordedAt = parseDate(parsed.data.recordedAt);

  if (!range.ok) {
    await db.insert(attendanceEvents).values({
      clientEventId: parsed.data.clientEventId,
      sessionId: session.id,
      userId: context.userId,
      employeeId: context.employee.id,
      stationId: station.id,
      type: 'check_out',
      source: 'mobile',
      status: 'rejected',
      recordedAt,
      latitude: toDbNumber(parsed.data.latitude),
      longitude: toDbNumber(parsed.data.longitude),
      accuracyMeters: parsed.data.accuracyMeters != null ? Math.round(parsed.data.accuracyMeters) : null,
      distanceMeters: range.distance,
      rejectionReason: range.reason,
    }).onConflictDoNothing({ target: attendanceEvents.clientEventId });

    return c.json({ error: range.reason, distanceMeters: range.distance }, 422);
  }

  const [closedSession] = await db.update(workSessions).set({
    status: 'closed',
    endedAt: recordedAt,
    checkOutLatitude: toDbNumber(parsed.data.latitude),
    checkOutLongitude: toDbNumber(parsed.data.longitude),
    checkOutAccuracyMeters: parsed.data.accuracyMeters != null ? Math.round(parsed.data.accuracyMeters) : null,
    checkOutDistanceMeters: range.distance,
  }).where(eq(workSessions.id, session.id)).returning();

  await db.insert(attendanceEvents).values({
    clientEventId: parsed.data.clientEventId,
    sessionId: session.id,
    userId: context.userId,
    employeeId: context.employee.id,
    stationId: station.id,
    type: 'check_out',
    source: 'mobile',
    status: 'accepted',
    recordedAt,
    latitude: toDbNumber(parsed.data.latitude),
    longitude: toDbNumber(parsed.data.longitude),
    accuracyMeters: parsed.data.accuracyMeters != null ? Math.round(parsed.data.accuracyMeters) : null,
    distanceMeters: range.distance,
  }).onConflictDoNothing({ target: attendanceEvents.clientEventId });

  return c.json({ session: closedSession });
});

app.post('/location-points/batch', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = batchLocationPayload.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'نقاط الموقع غير صحيحة' }, 400);
  }

  const context = await getMobileEmployeeContext(c);
  if (context instanceof Response) return context;

  const rows: Array<typeof locationPoints.$inferInsert> = [];

  for (const point of parsed.data.points) {
    const [session] = await db
      .select()
      .from(workSessions)
      .where(eq(workSessions.clientSessionId, point.clientSessionId))
      .limit(1);

    if (!session || session.employeeId !== context.employee.id) continue;

    rows.push({
      clientPointId: point.clientPointId,
      sessionId: session.id,
      clientSessionId: point.clientSessionId,
      userId: context.userId,
      employeeId: context.employee.id,
      stationId: session.stationId,
      recordedAt: parseDate(point.recordedAt),
      latitude: toDbNumber(point.latitude)!,
      longitude: toDbNumber(point.longitude)!,
      accuracyMeters: point.accuracyMeters != null ? Math.round(point.accuracyMeters) : null,
      speedMetersPerSecond: toDbNumber(point.speedMetersPerSecond),
      headingDegrees: toDbNumber(point.headingDegrees),
      batteryLevel: toDbNumber(point.batteryLevel),
      isOffline: point.isOffline,
    });
  }

  if (rows.length === 0) {
    return c.json({ accepted: 0 });
  }

  const inserted = await db
    .insert(locationPoints)
    .values(rows)
    .onConflictDoNothing({ target: locationPoints.clientPointId })
    .returning({ id: locationPoints.id });

  return c.json({ accepted: inserted.length });
});

export default app;
