/**
 * محاولة أخيرة: خدع بسيطة قد تكون فاتت عليّ
 */
import sql from 'mssql';

const BASE = {
  server: 'localhost',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 3_000,
};

async function tryLogin(user, pw) {
  const pool = new sql.ConnectionPool({ ...BASE, database: 'master', user, password: pw });
  try {
    await pool.connect();
    await pool.close();
    return true;
  } catch (e) {
    return { err: e.message };
  }
}

// خدع بسيطة احتمالية:
const candidates = [
  // فارغ / single char
  '', ' ', '.', '-', '_', '*', '!', '@', '#', '$', '0', '1',
  // null-like literals
  'null', 'NULL', 'Null', 'none', 'None', 'empty', 'Empty', 'void',
  // "not empty" meaning
  'notempty', 'NotEmpty', 'NOTEMPTY', 'not_empty', 'not-empty',
  'and', 'AND', 'notnull',
  // User name as password
  'sa', 'Administrator', 'administrator', 'ADMINISTRATOR',
  'admin', 'Admin', 'ADMIN',
  // exact literal with homoglyphs / typos
  'nulandnotempty', 'nullandotempty', 'nullanotempty', 'nullandotempt',
  'nullandotemty', 'nullandnotemty', 'nulandotempty',
  'Null and not empty', 'Null And Not Empty', 'NullAndNotEmpty',
  'null,and,not,empty', 'null/and/not/empty',
  // Misdirection words
  'smart', 'trick', 'خدعة', 'ذكي', 'تشفير', 'تشفير ذكي',
  'password', 'Password', 'PASSWORD',
  'kalimatAlsir', 'كلمة السر', 'كلمة_السر',
  // Specific ECAS
  'mypassword', 'mypassword4', 'mypassword4login', 'mypassword4lonin',
  'MyPassword4Login', 'MyPassword4Lonin',
  'ecas', 'Ecas', 'ECAS', 'ECAS_Admin', 'ecas_admin',
  // Base64-like
  'MTEyMjU1MTE=', 'MTEyMjU1MTE==', 'mteymju1mte',
  'MTIzMTIz=', 'MTIzMTIz==',
  // Time-related
  '20260421', '21042026', 'Apr21',
  // Short numerics (for brute)
  '0000', '00000000', '00', '000',
  '9999', '99999999', '1', '11', '111', '1111',
  // Special
  ' sa', 'sa ', 'sa\n', 'sa\t',
  // Literal with quotes?
  '"sa"', "'sa'",
  // Variations
  'SaAdmin', 'saadmin', 'sa2026',
];

async function main() {
  console.log(`┌─ خدع بسيطة (${candidates.length} محاولة) ─┐\n`);
  let firstErr = null;
  for (const pw of candidates) {
    const r = await tryLogin('sa', pw);
    if (r === true) {
      console.log(`\n⭐⭐⭐ MATCH !!!`);
      console.log(`   sa / "${pw}" (طول=${pw.length})`);
      const hex = Buffer.from(pw, 'utf8').toString('hex');
      console.log(`   hex: ${hex}`);
      process.exit(0);
    }
    if (!firstErr) firstErr = r.err;
  }
  console.log(`\n(${candidates.length} محاولة فشلت)`);
  console.log(`أول خطأ للتشخيص: ${firstErr}`);

  // جرب لو sa معطّل أصلاً
  console.log('\n--- فحص: هل sa مفعّل؟ ---');
  const pool = new sql.ConnectionPool({
    ...BASE, database: 'master', user: 'almham_reader', password: 'AlhamRead@2026!',
  });
  try {
    await pool.connect();
    const res = await pool.request().query(`
      SELECT name, is_disabled, type_desc
      FROM sys.server_principals
      WHERE name IN ('sa', 'Administrator') OR type IN ('S','U')
    `);
    console.table(res.recordset);
    await pool.close();
  } catch (e) {
    console.log('فشل:', e.message);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
