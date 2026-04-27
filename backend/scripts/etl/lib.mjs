/**
 * Shared helpers for ETL scripts.
 */
import sql from 'mssql';
import postgres from 'postgres';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '..', '.env') });

/** قواعد ECAS التي نستخدمها (نملكها) */
export const ECAS_DATABASES = [
  { code: 'Ecas2673', station: 'dahamiya', label: 'الدهمية' },
  { code: 'Ecas2668', station: 'sabaliya', label: 'مجموعة الصبالية' },
];

/** تصنيف محطة المشترك في قاعدة الصبالية حسب اسم المربع */
export function classifySabaliyaSquare(squareName) {
  if (!squareName) return { station: 'sabaliya', needsReview: true };
  const n = String(squareName);
  if (n.includes('جمال')) return { station: 'jamal', needsReview: false };
  if (n.includes('غليل') || n.includes('غلل')) return { station: 'ghalil', needsReview: false };
  if (n.includes('صبالي') || n.includes('الصبالي')) return { station: 'sabaliya', needsReview: false };
  return { station: 'sabaliya', needsReview: true }; // غير مصنّف → صبالية بعلامة مراجعة
}

/** إنشاء اتصال SQL Server لقاعدة محدّدة */
export async function mssqlPool(dbName) {
  const pool = new sql.ConnectionPool({
    server: 'localhost',
    user: 'almham_reader',
    password: 'AlhamRead@2026!',
    database: dbName,
    options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
    connectionTimeout: 15_000,
    requestTimeout: 5 * 60_000, // 5 min للجداول الكبيرة
    pool: { max: 4, min: 0 },
  });
  pool.on('error', (err) => console.error(`[mssql ${dbName}]`, err.message));
  await pool.connect();
  return pool;
}

/** إنشاء اتصال PostgreSQL */
export function pgClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL env var not set');
  return postgres(url, { max: 4, onnotice: () => {} });
}

/** تقسيم مصفوفة إلى دفعات */
export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** طباعة شريط تقدم بسيط */
export function progress(label, done, total, extra = '') {
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
  const bar = '█'.repeat(Math.floor(pct / 5)).padEnd(20, '░');
  process.stdout.write(`\r  ${label} ${bar} ${pct}% (${done}/${total}) ${extra}      `);
  if (done >= total) process.stdout.write('\n');
}

/** تسجيل دفعة استيراد */
export async function logImportRun(pg, ecasDb, tableName, stats) {
  await pg`
    INSERT INTO billing_import_runs (
      ecas_db, table_name, rows_read, rows_inserted, rows_updated, rows_skipped, rows_failed,
      error_log, started_at, finished_at, duration_ms
    )
    VALUES (
      ${ecasDb}, ${tableName}, ${stats.read ?? 0}, ${stats.inserted ?? 0}, ${stats.updated ?? 0},
      ${stats.skipped ?? 0}, ${stats.failed ?? 0}, ${stats.error ?? null},
      ${stats.startedAt}, ${new Date()}, ${Date.now() - stats.startedAt.getTime()}
    )
  `;
}

/** نقطة بدء مؤقّت */
export function startTimer() {
  const started = new Date();
  return {
    started,
    elapsed() {
      const ms = Date.now() - started.getTime();
      return ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60_000).toFixed(1)}m`;
    },
  };
}
