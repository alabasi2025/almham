/**
 * تحقّق عميق: أبحث عن آلية تحقّق كلمة سر Administrator فعلياً
 *  - كل الجداول
 *  - كل Stored Procedures
 *  - كل Functions
 *  - MD5/SHA1/SHA256 لـ "11225511" vs MOBSERL
 *  - hash للمرشّحين الآخرين
 */
import sql from 'mssql';
import crypto from 'crypto';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  database: 'Ecas2668',
};

const CANDIDATES = [
  '11225511', 'mypassword4lonin', 'mypassword4login', 'Administrator', 'admin',
  'nullandnotempty', 'MTEyMjU1MTE', '123123', 'MTIzMTIz',
  'YemenID', 'zuakha033', '2026', 'ecasnet', 'Admin@206', 'challengers',
  'system', 'sa', 'Y', 'system programmer', 'مبرمج النظام',
];

const MOBSERL_ADMIN = '3647081526bc30c8';
const MOBSERL_ADMIN2 = '4161fbe0f94da0ed';

function hashes(input) {
  const md5 = crypto.createHash('md5').update(input, 'utf8').digest('hex');
  const md5u = crypto.createHash('md5').update(input, 'utf16le').digest('hex');
  const sha1 = crypto.createHash('sha1').update(input, 'utf8').digest('hex');
  const sha256 = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  return { md5, md5u, sha1, sha256 };
}

function short(h) { return h.substring(0, 16); }

async function main() {
  console.log('═══ جزء 1: مقارنة hashes مع MOBSERL ═══');
  console.log(`MOBSERL (Administrator)  = ${MOBSERL_ADMIN}`);
  console.log(`MOBSERL (Administrator2) = ${MOBSERL_ADMIN2}`);
  console.log();

  for (const c of CANDIDATES) {
    const h = hashes(c);
    const matches = [];
    if (short(h.md5) === MOBSERL_ADMIN || short(h.md5) === MOBSERL_ADMIN2) matches.push('MD5[0:16] match!');
    if (short(h.md5u) === MOBSERL_ADMIN || short(h.md5u) === MOBSERL_ADMIN2) matches.push('MD5-UTF16[0:16] match!');
    if (short(h.sha1) === MOBSERL_ADMIN || short(h.sha1) === MOBSERL_ADMIN2) matches.push('SHA1[0:16] match!');
    if (short(h.sha256) === MOBSERL_ADMIN || short(h.sha256) === MOBSERL_ADMIN2) matches.push('SHA256[0:16] match!');
    // last 16 chars
    if (h.md5.substring(16) === MOBSERL_ADMIN || h.md5.substring(16) === MOBSERL_ADMIN2) matches.push('MD5[16:32] match!');
    if (h.sha1.substring(h.sha1.length-16) === MOBSERL_ADMIN) matches.push('SHA1-tail match!');

    if (matches.length) {
      console.log(`⭐⭐⭐ "${c}" → ${matches.join(', ')}`);
      console.log(`   MD5: ${h.md5}`);
      console.log(`   MD5u: ${h.md5u}`);
      console.log(`   SHA1: ${h.sha1}`);
    }
  }
  console.log('(نهاية جزء 1)');

  const pool = new sql.ConnectionPool(CONFIG);
  await pool.connect();

  try {
    // ═══ جزء 2: كل الجداول ═══
    console.log('\n═══ جزء 2: كل جداول Ecas2668 (الأسماء فقط) ═══');
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME
    `);
    console.log(`عدد: ${tables.recordset.length}`);
    for (const t of tables.recordset) {
      console.log(`   ${t.TABLE_NAME}`);
    }

    // ═══ جزء 3: SPs و Functions ═══
    console.log('\n═══ جزء 3: Stored Procedures + Functions ═══');
    const routines = await pool.request().query(`
      SELECT ROUTINE_TYPE, ROUTINE_NAME
      FROM INFORMATION_SCHEMA.ROUTINES
      ORDER BY ROUTINE_TYPE, ROUTINE_NAME
    `);
    console.log(`عدد: ${routines.recordset.length}`);
    for (const r of routines.recordset) {
      console.log(`   ${r.ROUTINE_TYPE.padEnd(10)} ${r.ROUTINE_NAME}`);
    }

    // ═══ جزء 4: أي SP تحتوي "pass" أو "login" أو "admin" ═══
    console.log('\n═══ جزء 4: SPs/Functions بأسماء مشبوهة ═══');
    const suspRoutines = await pool.request().query(`
      SELECT ROUTINE_NAME, ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_NAME LIKE '%pass%'
         OR ROUTINE_NAME LIKE '%login%'
         OR ROUTINE_NAME LIKE '%user%'
         OR ROUTINE_NAME LIKE '%auth%'
         OR ROUTINE_NAME LIKE '%admin%'
         OR ROUTINE_DEFINITION LIKE '%Administrator%'
         OR ROUTINE_DEFINITION LIKE '%BILLING_MANAGERS_USERS%'
    `);
    console.log(`عدد: ${suspRoutines.recordset.length}`);
    for (const r of suspRoutines.recordset) {
      console.log(`\n─── ${r.ROUTINE_NAME} ───`);
      console.log(r.ROUTINE_DEFINITION ?? '(no definition)');
    }

    // ═══ جزء 5: كل الأعمدة التي تحتوي "pass" أو "hash" أو "secret" ═══
    console.log('\n═══ جزء 5: أعمدة مشبوهة في جميع الجداول ═══');
    const suspCols = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%pass%'
         OR COLUMN_NAME LIKE '%pwd%'
         OR COLUMN_NAME LIKE '%hash%'
         OR COLUMN_NAME LIKE '%secret%'
         OR COLUMN_NAME LIKE '%sign%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    for (const c of suspCols.recordset) {
      console.log(`   ${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE})`);
    }

    // ═══ جزء 6: كل القيم في كل أعمدة كلمة السر للسجلات ذات Administrator ═══
    console.log('\n═══ جزء 6: قيم كل أعمدة كلمة السر للـ Administrator ═══');
    for (const c of suspCols.recordset) {
      try {
        const r = await pool.request().query(`
          SELECT TOP 20 *
          FROM [${c.TABLE_NAME}]
          WHERE [${c.COLUMN_NAME}] IS NOT NULL
            AND LTRIM(RTRIM(CAST([${c.COLUMN_NAME}] AS NVARCHAR(MAX)))) <> ''
        `);
        if (r.recordset.length) {
          console.log(`\n─── ${c.TABLE_NAME}.${c.COLUMN_NAME} (${r.recordset.length}+ rows) ───`);
          for (const row of r.recordset) {
            console.log('  ', JSON.stringify(row));
          }
        }
      } catch (e) {
        console.log(`   ⚠️  ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${e.message}`);
      }
    }

  } finally {
    await pool.close();
  }

  console.log('\n✅ انتهى');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
