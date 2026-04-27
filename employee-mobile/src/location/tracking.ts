import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { createClientId, enqueueRequest } from '@/storage/offline-store';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/storage/secure-token';
import { LocationPointPayload } from '@/types/attendance';

const TASK_NAME = 'almham-background-location';
const ACTIVE_SESSION_KEY = 'almham_active_client_session_id';

type LocationTaskData = {
  locations: Location.LocationObject[];
};

function pointFromLocation(
  clientSessionId: string,
  location: Location.LocationObject,
  isOffline: boolean,
): LocationPointPayload {
  return {
    clientPointId: createClientId('point'),
    clientSessionId,
    recordedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? null,
    speedMetersPerSecond: location.coords.speed ?? null,
    headingDegrees: location.coords.heading ?? null,
    isOffline,
  };
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  const taskData = data as LocationTaskData | undefined;
  if (error || !taskData?.locations?.length) return;

  const clientSessionId = await getSecureItem(ACTIVE_SESSION_KEY);
  if (!clientSessionId) return;

  const points = taskData.locations.map((location) => pointFromLocation(clientSessionId, location, true));
  await enqueueRequest('/api/attendance/location-points/batch', { points });
});

export async function getCurrentPosition() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('تم رفض إذن الموقع');
  }

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
  });
}

export async function startBackgroundTracking(clientSessionId: string, intervalSeconds: number) {
  await setSecureItem(ACTIVE_SESSION_KEY, clientSessionId);

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('إذن الموقع مطلوب لتسجيل الوردية');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('إذن الموقع في الخلفية مطلوب لحفظ مسار العمل');
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: Math.max(60, intervalSeconds) * 1000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'وردية العباسي قيد التشغيل',
      notificationBody: 'يتم حفظ مسار العمل حتى تسجيل الانصراف.',
      notificationColor: '#0f766e',
    },
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  await deleteSecureItem(ACTIVE_SESSION_KEY);
}

export async function getActiveClientSessionId() {
  return getSecureItem(ACTIVE_SESSION_KEY);
}

export async function queueCurrentPoint(clientSessionId: string, isOffline: boolean) {
  const location = await getCurrentPosition();
  const point = pointFromLocation(clientSessionId, location, isOffline);
  await enqueueRequest('/api/attendance/location-points/batch', { points: [point] });
  return point;
}
