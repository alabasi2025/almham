/**
 * تحليل شامل لتشفير كلمة سر Administrator في BILLING_MANAGERS_USERS
 *
 * ما يفعله:
 *  1. يسرد كل قواعد Ecas* المركّبة محلياً (مش بس 2668/2673)
 *  2. لكل قاعدة: يقرأ كل الأعمدة كلها لسجلات Administrator
 *  3. يعرض P الخام + كل تمثيل ممكن (hex, base64 decode, chars, bytes length, varbinary)
 *  4. يقارن مع الـ baseline المعروف (Base64 لـ 11225511)
 *  5. يلفت الانتباه لأي اختلاف
 */
import sql from 'mssql';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15_000,
  requestTimeout: 60_000,
};

const BASELINE_ENCODED = 'MTEyMjU1MTE';  // Base64("11225511")
const BASELINE_DECODED = '11225511';

function hexdump(buf) {
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function charCodes(str) {
  return [...String(str)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
}

async function main() {
  // 1. قائمة القواعد المركّبة
  const master = new sql.ConnectionPool({ ...CONFIG, database: 'master' });
  await master.connect();
  const dbsR = await master.request().query(`
    SELECT name FROM sys.databases WHERE name LIKE 'Ecas%' ORDER BY name
  `);
  const dbs = dbsR.recordset.map(r => r.name);
  await master.close();

  console.log(`🗄️  قواعد ECAS المركّبة محلياً: ${dbs.join(', ')}\n`);

  // 2. لكل قاعدة: افحص Administrator في BILLING_MANAGERS_USERS
  for (const dbName of dbs) {
    console.log('═'.repeat(80));
    console.log(`📦 ${dbName}`);
    console.log('═'.repeat(80));

    const pool = new sql.ConnectionPool({ ...CONFIG, database: dbName });
    try {
      await pool.connect();
    } catch (e) {
      console.log(`❌ فشل الاتصال: ${e.message}\n`);
      continue;
    }

    try {
      // 2a. هل الجدول موجود؟
      const tblR = await pool.request().query(`
        SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BILLING_MANAGERS_USERS'
      `);
      if (tblR.recordset[0].c === 0) {
        console.log('⚠️  BILLING_MANAGERS_USERS غير موجود\n');
        continue;
      }

      // 2b. قائمة الأعمدة
      const colsR = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BILLING_MANAGERS_USERS'
        ORDER BY ORDINAL_POSITION
      `);
      const cols = colsR.recordset.map(c => c.COLUMN_NAME);
      console.log(`📋 الأعمدة (${cols.length}): ${cols.join(', ')}`);

      // 2c. كل السجلات (مش بس Administrator — نشوف النموذج)
      const allR = await pool.request().query(`
        SELECT *, CONVERT(VARBINARY(MAX), P) AS P_BYTES
        FROM BILLING_MANAGERS_USERS
        ORDER BY USER_NO
      `);

      console.log(`\n👥 كل السجلات (${allR.recordset.length}):`);
      for (const row of allR.recordset) {
        const name = row.NAME ?? '(null)';
        const p = row.P;
        const pBytes = row.P_BYTES ? Buffer.from(row.P_BYTES) : null;
        const pStr = p == null ? '(null)' : String(p);
        const pLen = pStr.length;
        const pHex = pBytes ? hexdump(pBytes) : '';
        const pCharCodes = p == null ? '' : charCodes(pStr);

        // محاولات فكّ
        let b64Decode = null;
        try {
          const dec = Buffer.from(pStr, 'base64').toString('utf8');
          if (/^[\x20-\x7e]+$/.test(dec)) b64Decode = dec;
        } catch {}

        // مقارنة مع baseline
        const isBaselineAdmin = pStr === BASELINE_ENCODED;
        const isBaselineOther = pStr === 'MTIzMTIz';
        const flag =
          isBaselineAdmin ? '✓ baseline Admin (11225511)' :
          isBaselineOther ? '✓ baseline other (123123)' :
          '⚠️  مختلف عن baseline!';

        console.log(`\n  ┌ USER_NO=${String(row.USER_NO).padStart(3)} | NAME="${name}"`);
        console.log(`  │   STATUS=${row.STATUS} | ISMANAGER=${row.ISMANAGER} | ADJECTIVE="${row.ADJECTIVE ?? ''}"`);
        console.log(`  │   P (text)     = ${JSON.stringify(pStr)} [len=${pLen}]`);
        console.log(`  │   P (hex)      = ${pHex}`);
        console.log(`  │   P (charCodes)= ${pCharCodes}`);
        console.log(`  │   b64 decode   = ${JSON.stringify(b64Decode)}`);
        console.log(`  └─  ${flag}`);
      }

      // 2d. كل الأعمدة التي تحتوي على "Administrator" في أي مكان
      const searchR = await pool.request().query(`
        SELECT *
        FROM BILLING_MANAGERS_USERS
        WHERE NAME LIKE '%Administrator%' OR ADJECTIVE LIKE '%Administrator%'
           OR CAST(P AS NVARCHAR(MAX)) LIKE '%Administrator%'
      `);
      if (searchR.recordset.length) {
        console.log(`\n🔎 سجلات تحتوي "Administrator" في أي عمود (${searchR.recordset.length}):`);
        for (const row of searchR.recordset) {
          console.log('    ', JSON.stringify(row));
        }
      }

      // 2e. فحص آخر تعديل لكل سجل
      try {
        const changeR = await pool.request().query(`
          SELECT USER_NO, NAME, LAST_LOGIN
          FROM BILLING_MANAGERS_USERS
          ORDER BY LAST_LOGIN DESC
        `);
        console.log(`\n⏰ آخر تسجيل دخول:`);
        for (const r of changeR.recordset.slice(0, 5)) {
          console.log(`   USER_NO=${r.USER_NO} "${r.NAME}" → ${r.LAST_LOGIN}`);
        }
      } catch {}

    } finally {
      await pool.close();
    }

    console.log('');
  }

  console.log('\n✅ انتهى الفحص الشامل');
  process.exit(0);
}

main().catch(e => {
  console.error('❌', e);
  process.exit(1);
});
