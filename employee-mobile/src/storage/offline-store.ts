import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export interface QueuedRequest {
  id: string;
  path: string;
  method: 'POST';
  body: unknown;
  createdAt: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const webQueue: QueuedRequest[] = [];
const webStorageKey = 'almham_queued_requests';

function readWebQueue() {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return webQueue;
  try {
    const raw = localStorage.getItem(webStorageKey);
    return raw ? JSON.parse(raw) as QueuedRequest[] : [];
  } catch {
    return [];
  }
}

function writeWebQueue(rows: QueuedRequest[]) {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  localStorage.setItem(webStorageKey, JSON.stringify(rows));
}

function createDb() {
  return SQLite.openDatabaseAsync('almham-attendance.db');
}

async function getDb() {
  dbPromise ??= createDb();
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS queued_requests (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueRequest(path: string, body: unknown) {
  const request: QueuedRequest = {
    id: createClientId('queue'),
    path,
    method: 'POST',
    body,
    createdAt: new Date().toISOString(),
  };

  if (Platform.OS === 'web') {
    const rows = readWebQueue();
    rows.push(request);
    writeWebQueue(rows);
    return request;
  }

  const db = await getDb();
  await db.runAsync(
    'INSERT INTO queued_requests (id, path, method, body, created_at) VALUES (?, ?, ?, ?, ?)',
    request.id,
    request.path,
    request.method,
    JSON.stringify(request.body),
    request.createdAt,
  );

  return request;
}

export async function getQueuedRequests(limit = 50): Promise<QueuedRequest[]> {
  if (Platform.OS === 'web') {
    return readWebQueue().slice(0, limit);
  }

  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    path: string;
    method: 'POST';
    body: string;
    created_at: string;
  }>(
    'SELECT id, path, method, body, created_at FROM queued_requests ORDER BY created_at ASC LIMIT ?',
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    method: row.method,
    body: JSON.parse(row.body),
    createdAt: row.created_at,
  }));
}

export async function removeQueuedRequest(id: string) {
  if (Platform.OS === 'web') {
    writeWebQueue(readWebQueue().filter((row) => row.id !== id));
    return;
  }

  const db = await getDb();
  await db.runAsync('DELETE FROM queued_requests WHERE id = ?', id);
}

export async function countQueuedRequests() {
  if (Platform.OS === 'web') {
    return readWebQueue().length;
  }

  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM queued_requests');
  return row?.count ?? 0;
}
