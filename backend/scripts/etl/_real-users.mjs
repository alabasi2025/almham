/**
 * قراءة مستخدمي النظام الحقيقيين من جدول UserData
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';
import fs from 'node:fs';

function decodeB64(s) {
  if (!s) return '—';
  try { return Buffer.from(String(s), 'base64').toString('utf8'); }
  catch { return '(خطأ)'; }
}

async function main() {
  const lines = [];
  const log = (s = '') => { console.log(s); lines.push(s); };

  for (const { code, label } of ECAS_DATABASES) {
    log(`\n${'═'.repeat(80)}`);
    log(`📦  ${code} — ${label}`);
    log('═'.repeat(80));

    const mssql = await mssqlPool(code);
    try {
      // أعمدة UserData
      const cols = await mssql.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'UserData'
        ORDER BY ORDINAL_POSITION
      `);
      log('\n📋 أعمدة UserData:');
      for (const c of cols.recordset) log(`   - ${c.COLUMN_NAME} (${c.DATA_TYPE})`);

      const r = await mssql.request().query('SELECT * FROM UserData ORDER BY Us_ID');
      log(`\n👥 عدد السجلات: ${r.recordset.length}`);

      for (const u of r.recordset) {
        log(`\n   ╭─ USER ${u.Us_ID} ─────────────────────────────`);
        for (const [k, v] of Object.entries(u)) {
          let display = v;
          if (v instanceof Date) display = v.toISOString().slice(0, 16).replace('T', ' ');
          if (k === 'Us_PassWord' && v) display = `${v}  →  "${decodeB64(v)}"`;
          log(`   │ ${k.padEnd(25)}: ${display ?? '—'}`);
        }
        log(`   ╰──────────────────────────────────────────`);
      }
    } finally {
      await mssql.close();
    }
  }

  fs.writeFileSync('real-users-report.txt', lines.join('\n'), 'utf8');
  log('\n✅ حُفظ التقرير في real-users-report.txt');
  process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
