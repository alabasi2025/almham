export interface AuthUser {
  id: string;
  username: string;
  role: string;
  employeeId: string | null;
  stationId: string | null;
  mustChangePassword: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  stationId: string | null;
  status: 'active' | 'inactive';
}

export interface Station {
  id: string;
  name: string;
  location: string;
  latitude: string | number | null;
  longitude: string | number | null;
}

export interface AttendanceSettings {
  radiusMeters: number;
  trackingIntervalSeconds: number;
  requireGps: boolean;
  requireBiometric: boolean;
}

export interface WorkSession {
  id: string;
  clientSessionId: string;
  userId: string;
  employeeId: string;
  stationId: string;
  status: 'open' | 'closed' | 'abandoned';
  startedAt: string;
  endedAt: string | null;
}

export interface MobileBootstrap {
  user: AuthUser;
  employee: Employee;
  station: Station | null;
  settings: AttendanceSettings | null;
  openSession: WorkSession | null;
}

export interface AttendanceLocationPayload {
  clientSessionId: string;
  clientEventId: string;
  stationId?: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export interface LocationPointPayload {
  clientPointId: string;
  clientSessionId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMetersPerSecond?: number | null;
  headingDegrees?: number | null;
  batteryLevel?: number | null;
  isOffline: boolean;
}
