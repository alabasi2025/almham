export interface AttendanceDashboard {
  summary: {
    openSessions: number;
    todayAcceptedEvents: number;
    todayRejectedEvents: number;
  };
  openSessions: AttendanceOpenSession[];
  recentEvents: AttendanceEventRow[];
  settings: StationAttendanceSetting[];
}

export interface AttendanceOpenSession {
  id: string;
  clientSessionId: string;
  status: 'open' | 'closed' | 'abandoned';
  startedAt: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  stationId: string;
  stationName: string;
  stationLocation: string;
  checkInDistanceMeters: number | null;
  checkInAccuracyMeters: number | null;
  lastPoint: AttendanceLocationPoint | null;
}

export interface AttendanceLocationPoint {
  sessionId: string | null;
  recordedAt: string;
  latitude: string | number;
  longitude: string | number;
  accuracyMeters: number | null;
  isOffline: boolean;
}

export interface AttendanceEventRow {
  id: string;
  type: 'check_in' | 'check_out';
  source: 'mobile' | 'zkteco' | 'manager';
  status: 'accepted' | 'rejected';
  recordedAt: string;
  receivedAt: string;
  distanceMeters: number | null;
  rejectionReason: string | null;
  employeeName: string;
  stationName: string;
}

export interface StationAttendanceSetting {
  stationId: string;
  radiusMeters: number;
  trackingIntervalSeconds: number;
  requireGps: boolean;
  requireBiometric: boolean;
}
