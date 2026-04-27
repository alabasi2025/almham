/**
 * تحليل تشفير DB_PassWord
 *
 * الهدف: فكّ خوارزمية التشفير المستخدمة في:
 *   - Branch.Brn_DBPassWord
 *   - DB_And_Sys_Info.DB_PassWord
 *   - CompInfoAndSysOption.nDB_UserPassWord
 *
 * الاستراتيجية:
 *   1) جلب القيمة الخام (bytes) من SQL Server
 *   2) تحليل توزيع البايت (entropy, histogram)
 *   3) تجربة XOR بمفاتيح شائعة
 *   4) محاولة فكّ الترميز العربي (قد تكون نصّ عربي مُشفَّر بـ Windows-1256)
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

function hexdump(buf, max = 256) {
  const lines = [];
  for (let i = 0; i < Math.min(buf.length, max); i += 16) {
    const chunk = buf.slice(i, Math.min(i + 16, buf.length));
    const hex = [...chunk].map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...chunk].map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.').join('');
    lines.push(`  [${i.toString(16).padStart(4, '0')}] ${hex.padEnd(48)} | ${ascii}`);
  }
  return lines.join('\n');
}

function tryXorWithAscii(buf, key) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ key.charCodeAt(i % key.length);
  }
  return out;
}

function asciiRatio(buf) {
  let printable = 0;
  for (const b of buf) {
    if (b >= 0x20 && b <= 0x7e) printable++;
  }
  return printable / buf.length;
}

async function analyze(ecasDb, label) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📦 ${ecasDb} — ${label}`);
  console.log('═'.repeat(70));

  const mssql = await mssqlPool(ecasDb);
  try {
    // 1) DB_And_Sys_Info.DB_PassWord
    const r1 = await mssql.request().query(`
      SELECT TOP 1
        DB_Name,
        DB_PassWord,
        CONVERT(VARBINARY(MAX), DB_PassWord) AS pw_bytes
      FROM DB_And_Sys_Info
    `);
    if (r1.recordset.length) {
      const row = r1.recordset[0];
      const bytes = Buffer.from(row.pw_bytes);
      console.log(`\n── DB_And_Sys_Info.DB_PassWord ──`);
      console.log(`   DB_Name  : "${row.DB_Name}"`);
      console.log(`   raw text : "${row.DB_PassWord}"`);
      console.log(`   length   : ${bytes.length} بايت`);
      console.log(`   ASCII %  : ${(asciiRatio(bytes) * 100).toFixed(0)}%`);
      console.log(`   hex dump :`);
      console.log(hexdump(bytes));

      // قراءة بترميز Windows-1256 (العربي)
      try {
        const asArabic = new TextDecoder('windows-1256').decode(bytes);
        console.log(`   كـ Windows-1256: "${asArabic}"`);
      } catch {}

      // محاولة XOR بمفاتيح شائعة
      console.log('\n   🔎 محاولات فكّ XOR:');
      const keys = [
        'ecas', 'ECAS', 'YemenID', 'yemenid', 'Admin', 'password',
        'mypassword4lonin', 'zuakha033', 'mghrbi', '12345', 'ecasnet',
        String.fromCharCode(0xAA), 'A', '1', '0'
      ];
      for (const k of keys) {
        const out = tryXorWithAscii(bytes, k);
        const ratio = asciiRatio(out);
        if (ratio > 0.8) {
          console.log(`     ✅ مفتاح "${k}" → "${out.toString('utf8')}" (${(ratio*100).toFixed(0)}% ASCII)`);
        }
      }
    }

    // 2) Branch.Brn_DBPassWord
    const r2 = await mssql.request().query(`
      SELECT TOP 3
        Brn_ID,
        Brn_DBName,
        Brn_DBPassWord,
        CONVERT(VARBINARY(MAX), Brn_DBPassWord) AS pw_bytes
      FROM Branch
    `);
    for (const row of r2.recordset) {
      const bytes = Buffer.from(row.pw_bytes);
      console.log(`\n── Branch.Brn_DBPassWord (Brn_ID=${row.Brn_ID}) ──`);
      console.log(`   DB_Name  : "${row.Brn_DBName}"`);
      console.log(`   raw text : "${row.Brn_DBPassWord}"`);
      console.log(`   length   : ${bytes.length} بايت`);
      console.log(`   hex      : ${[...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }

    // 3) CompInfoAndSysOption.nDB_UserPassWord
    try {
      const r3 = await mssql.request().query(`
        SELECT TOP 1
          nDB_UserPassWord,
          CONVERT(VARBINARY(MAX), nDB_UserPassWord) AS pw_bytes
        FROM CompInfoAndSysOption
      `);
      if (r3.recordset.length && r3.recordset[0].nDB_UserPassWord) {
        const row = r3.recordset[0];
        const bytes = Buffer.from(row.pw_bytes);
        console.log(`\n── CompInfoAndSysOption.nDB_UserPassWord ──`);
        console.log(`   raw      : "${row.nDB_UserPassWord}"`);
        console.log(`   length   : ${bytes.length} بايت`);
        console.log(`   hex      : ${[...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      }
    } catch (e) {
      console.log(`   ❌ ${e.message}`);
    }
  } finally {
    await mssql.close();
  }
}

async function main() {
  for (const { code, label } of ECAS_DATABASES) {
    await analyze(code, label);
  }
  process.exit(0);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
