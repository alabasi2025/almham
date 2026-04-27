import type {
  ConnectionProfile,
  LegacyDatabaseInfo,
  LegacyLoginResult,
  LegacyPasswordHintResponse,
  LegacyScreenDefinition,
  LegacyWorkspace,
} from './types';

const API_BASE = import.meta.env.VITE_ECAS_API_URL ?? 'http://127.0.0.1:5087';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(extractError(text) || `فشل الطلب: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function extractError(text: string): string {
  if (!text) return '';

  try {
    const payload = JSON.parse(text) as { detail?: string; title?: string; error?: string };
    return payload.detail ?? payload.error ?? payload.title ?? text;
  } catch {
    return text;
  }
}

export function loadDatabases(connection: ConnectionProfile) {
  return postJson<LegacyDatabaseInfo[]>('/api/ecas/databases', connection);
}

export function loadWorkspace(connection: ConnectionProfile, databaseName: string, take = 300) {
  return postJson<LegacyWorkspace>('/api/ecas/workspace', {
    connection,
    databaseName,
    take,
  });
}

export function loginToLegacyEcas(connection: ConnectionProfile, databaseName: string, userName: string, password: string) {
  return postJson<LegacyLoginResult>('/api/ecas/login', {
    connection,
    databaseName,
    userName,
    password,
  });
}

export function loadLegacyScreens(connection: ConnectionProfile, databaseName: string, userId: number, roleId: number) {
  return postJson<LegacyScreenDefinition[]>('/api/ecas/screens', {
    connection,
    databaseName,
    userId,
    roleId,
  });
}

export function loadPasswordHint(connection: ConnectionProfile, databaseName: string, userName: string) {
  return postJson<LegacyPasswordHintResponse>('/api/ecas/password-hint', {
    connection,
    databaseName,
    userName,
  });
}
