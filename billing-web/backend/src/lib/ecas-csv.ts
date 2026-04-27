import { parse } from 'csv-parse/sync';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export interface EcasSource {
  code: string;
  dbName: 'Ecas2673' | 'Ecas2668';
  label: string;
}

export const ECAS_SOURCES: EcasSource[] = [
  { code: 'dahamiya', dbName: 'Ecas2673', label: 'الدهمية' },
  { code: 'sabaliya-group', dbName: 'Ecas2668', label: 'الصبالية + جمال + غليل' },
];

interface CacheEntry {
  rows: Record<string, string>[];
  mtimeMs: number;
}

const cache = new Map<string, CacheEntry>();

function getDataDir(): string {
  const raw = process.env['BILLING_ECAS_DATA_DIR'] ?? '../../imports/ecas-data';
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

export function getCsvPath(dbName: string, tableName: string): string {
  return join(getDataDir(), `${dbName}.${tableName}.csv`);
}

export function loadTable(dbName: string, tableName: string): Record<string, string>[] {
  const filePath = getCsvPath(dbName, tableName);
  if (!existsSync(filePath)) return [];

  const stat = statSync(filePath);
  const cacheKey = `${dbName}.${tableName}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.rows;
  }

  const content = readFileSync(filePath, 'utf8');
  const rows = parse(content, {
    bom: true,
    columns: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  cache.set(cacheKey, { rows, mtimeMs: stat.mtimeMs });
  return rows;
}

export function countTableRows(dbName: string, tableName: string): number {
  return loadTable(dbName, tableName).length;
}
