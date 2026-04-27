import {
  AttendanceLocationPayload,
  MobileBootstrap,
  WorkSession,
} from '@/types/attendance';
import {
  getQueuedRequests,
  removeQueuedRequest,
} from '@/storage/offline-store';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/storage/secure-token';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';
const TOKEN_KEY = 'almham_mobile_token';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = 'API_ERROR',
  ) {
    super(message);
  }
}

interface LoginResponse {
  token?: string;
  expiresAt?: string;
  user: MobileBootstrap['user'];
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  skipAuth?: boolean;
}

export async function getToken() {
  return getSecureItem(TOKEN_KEY);
}

export async function clearToken() {
  await deleteSecureItem(TOKEN_KEY);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!options.skipAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(payload.error ?? 'تعذر الاتصال بالسيرفر', response.status);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('لا يوجد اتصال بالسيرفر الآن', 0, 'NETWORK_ERROR');
  }
}

export async function login(username: string, password: string) {
  const response = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: { username, password, client: 'mobile' },
  });

  if (!response.token) {
    throw new ApiError('السيرفر لم يرجع جلسة للجوال', 500);
  }

  await setSecureItem(TOKEN_KEY, response.token);
  return response.user;
}

export function bootstrap() {
  return request<MobileBootstrap>('/api/attendance/mobile/bootstrap');
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' }).catch(() => null);
  await clearToken();
}

export async function checkIn(payload: AttendanceLocationPayload) {
  return request<{ session: WorkSession; settings?: MobileBootstrap['settings'] }>('/api/attendance/check-in', {
    method: 'POST',
    body: payload,
  });
}

export async function checkOut(payload: AttendanceLocationPayload) {
  return request<{ session: WorkSession }>('/api/attendance/check-out', {
    method: 'POST',
    body: payload,
  });
}

export async function syncQueuedRequests() {
  let synced = 0;
  const queued = await getQueuedRequests();

  for (const item of queued) {
    await request(item.path, { method: item.method, body: item.body });
    await removeQueuedRequest(item.id);
    synced += 1;
  }

  return synced;
}
