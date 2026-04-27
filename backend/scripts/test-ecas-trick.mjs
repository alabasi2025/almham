/**
 * البحث عن "الخدعة" — تحليل كل الاحتمالات
 */
import sql from 'mssql';

async function getPool(dbName) {
  const pool = new sql.ConnectionPool({
    server: 'localhost',
    user: 'almham_reader',
    password: 'AlhamRead@2026!',
    database: dbName,
    options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
    connectionTimeout: 15_000,
    requestTimeout: 60_000,
  });
  await pool.connect();
  return pool;
}

const pool = await getPool('Ecas2673');

try {
  console.log('═'.repeat(65));
  console.log('🕵️ البحث عن الخدعة...');
  console.log('═'.repeat(65));

  // ═══ 1. هل كلمة السر مخزّنة بترميز مختلف (nvarchar/unicode)? ═══
  console.log('\n🔍 [1] فحص ترميز Unicode لـ Us_PassWord:');
  const uni = await pool.request().query(`
    SELECT
      Us_PassWord,
      CAST(Us_PassWord AS varbinary(MAX)) AS pw_vbin,
      CAST(Us_PassWord AS nvarchar(MAX)) AS pw_nvar,
      UNICODE(Us_PassWord) AS first_char_unicode,
      ASCII(Us_PassWord) AS first_char_ascii,
      DATALENGTH(Us_PassWord) AS data_len,
      LEN(Us_PassWord) AS str_len,
      HASHBYTES('MD5', Us_PassWord) AS md5_hash,
      HASHBYTES('SHA1', Us_PassWord) AS sha1_hash,
      HASHBYTES('SHA2_256', Us_PassWord) AS sha256_hash
    FROM UserData WHERE Us_ID = -1
  `);
  const r = uni.recordset[0];
  console.log(`   Us_PassWord: "${r.Us_PassWord}"`);
  console.log(`   varbinary: ${Buffer.from(r.pw_vbin).toString('hex')}`);
  console.log(`   nvarchar: "${r.pw_nvar}"`);
  console.log(`   first char unicode: ${r.first_char_unicode}`);
  console.log(`   first char ascii: ${r.first_char_ascii}`);
  console.log(`   DATALENGTH: ${r.data_len}`);
  console.log(`   LEN: ${r.str_len}`);
  console.log(`   MD5: ${Buffer.from(r.md5_hash).toString('hex')}`);
  console.log(`   SHA1: ${Buffer.from(r.sha1_hash).toString('hex')}`);
  console.log(`   SHA256: ${Buffer.from(r.sha256_hash).toString('hex')}`);

  // ═══ 2. هل فيه أحرف مخفية (zero-width, null bytes)? ═══
  console.log('\n🔍 [2] بحث عن أحرف مخفية:');
  const hidden = await pool.request().query(`
    SELECT
      REPLACE(Us_PassWord, CHAR(0), '[NUL]') AS check_null,
      REPLACE(Us_PassWord, CHAR(8), '[BS]') AS check_bs,
      REPLACE(Us_PassWord, CHAR(127), '[DEL]') AS check_del,
      CHARINDEX(CHAR(0), Us_PassWord) AS has_null,
      PATINDEX('%[^a-zA-Z0-9]%', Us_PassWord) AS has_special
    FROM UserData WHERE Us_ID = -1
  `);
  const h = hidden.recordset[0];
  console.log(`   NULL bytes: ${h.has_null > 0 ? 'نعم! عند الموقع ' + h.has_null : 'لا'}`);
  console.log(`   أحرف خاصة: ${h.has_special > 0 ? 'نعم! عند الموقع ' + h.has_special : 'لا'}`);

  // ═══ 3. مقارنة بين القاعدتين — هل القيمة متطابقة؟ ═══
  console.log('\n🔍 [3] مقارنة Administrator بين Ecas2673 و Ecas2668:');
  const pool2 = await getPool('Ecas2668');
  const r2 = await pool2.request().query(`
    SELECT Us_PassWord, CAST(Us_PassWord AS varbinary(MAX)) AS pw_vbin
    FROM UserData WHERE Us_ID = -1
  `);
  pool2.close();
  const pw1hex = Buffer.from(r.pw_vbin).toString('hex');
  const pw2hex = Buffer.from(r2.recordset[0].pw_vbin).toString('hex');
  console.log(`   Ecas2673: ${pw1hex}`);
  console.log(`   Ecas2668: ${pw2hex}`);
  console.log(`   متطابقة: ${pw1hex === pw2hex ? 'نعم' : '❌ لا!'}`);

  // ═══ 4. فحص كل الصفوف — هل Administrator لديه شيء مختلف؟ ═══
  console.log('\n🔍 [4] مقارنة كل المستخدمين — طول كلمة السر وترميزها:');
  const allPw = await pool.request().query(`
    SELECT Us_ID, Us_Name, Us_PassWord,
           DATALENGTH(Us_PassWord) AS dlen,
           LEN(Us_PassWord) AS slen,
           CAST(Us_PassWord AS varbinary(MAX)) AS vbin
    FROM UserData
    ORDER BY Us_ID
  `);
  for (const row of allPw.recordset) {
    const hex = row.vbin ? Buffer.from(row.vbin).toString('hex') : '(null)';
    console.log(`   [${String(row.Us_ID).padEnd(6)}] ${String(row.Us_Name).padEnd(30)} pw="${String(row.Us_PassWord ?? '').padEnd(20)}" dlen=${String(row.dlen ?? 0).padEnd(4)} hex=${hex}`);
  }

  // ═══ 5. هل يوجد stored procedures متعلقة بالمصادقة؟ ═══
  console.log('\n🔍 [5] Stored Procedures متعلقة بالمصادقة:');
  const procs = await pool.request().query(`
    SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_NAME LIKE '%login%' OR ROUTINE_NAME LIKE '%auth%'
       OR ROUTINE_NAME LIKE '%pass%' OR ROUTINE_NAME LIKE '%admin%'
       OR ROUTINE_NAME LIKE '%user%' OR ROUTINE_NAME LIKE '%verify%'
       OR ROUTINE_NAME LIKE '%check%' OR ROUTINE_NAME LIKE '%encrypt%'
       OR ROUTINE_NAME LIKE '%decrypt%' OR ROUTINE_NAME LIKE '%hash%'
  `);
  if (procs.recordset.length > 0) {
    for (const p of procs.recordset) {
      console.log(`   📂 ${p.ROUTINE_NAME}`);
      try {
        const def = await pool.request().query(`
          SELECT ROUTINE_DEFINITION FROM INFORMATION_SCHEMA.ROUTINES
          WHERE ROUTINE_NAME = '${p.ROUTINE_NAME}'
        `);
        if (def.recordset[0]?.ROUTINE_DEFINITION) {
          console.log(`      ${def.recordset[0].ROUTINE_DEFINITION.substring(0, 300)}`);
        }
      } catch {}
    }
  } else {
    console.log('   لا توجد stored procedures متعلقة');
  }

  // ═══ 6. هل يوجد views أو triggers متعلقة؟ ═══
  console.log('\n🔍 [6] Views و Triggers:');
  const views = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME LIKE '%user%' OR TABLE_NAME LIKE '%admin%' OR TABLE_NAME LIKE '%login%'
  `);
  console.log(`   Views: ${views.recordset.map(v => v.TABLE_NAME).join(', ') || 'لا يوجد'}`);

  const triggers = await pool.request().query(`
    SELECT name FROM sys.triggers WHERE name LIKE '%user%' OR name LIKE '%pass%'
  `);
  console.log(`   Triggers: ${triggers.recordset.map(t => t.name).join(', ') || 'لا يوجد'}`);

  // ═══ 7. فحص DB_PassWord بعمق — ربما هذا هو مفتاح الخدعة ═══
  console.log('\n🔍 [7] تحليل DB_PassWord (14 بايت مشفّرة):');
  const dbPw = await pool.request().query(`
    SELECT CAST(DB_PassWord AS varbinary(MAX)) AS pw_bin FROM DB_And_Sys_Info
  `);
  const dbPwBytes = [...Buffer.from(dbPw.recordset[0].pw_bin)];
  console.log(`   Bytes: [${dbPwBytes.join(', ')}]`);

  // محاولة: كل بايت ناقص القيمة المقابلة من "Administrator" + padding
  const adminBytes = [...Buffer.from('Administrator')]; // 13 bytes
  console.log(`\n   "Administrator" bytes: [${adminBytes.join(', ')}]`);
  console.log(`   DB_PassWord XOR "Administrator":`);
  const xored = dbPwBytes.map((b, i) => b ^ (adminBytes[i % adminBytes.length] || 0));
  console.log(`   Result: [${xored.join(', ')}]`);
  console.log(`   As text: "${Buffer.from(xored).toString('utf8')}"`);

  // ربما DB_PassWord هو تشفير لكلمة السر باستخدام اسم القاعدة كمفتاح
  const dbNames = ['Ecas2673', 'Ecas2668', 'ECAS', 'ecas', 'Ecas'];
  for (const name of dbNames) {
    const key = [...Buffer.from(name)];
    const dec = dbPwBytes.map((b, i) => b ^ key[i % key.length]);
    const text = Buffer.from(dec).toString('utf8');
    const printable = /^[\x20-\x7E]+$/.test(text);
    console.log(`   XOR("${name}"): [${dec.join(', ')}] → "${text}" ${printable ? '⚠️ مقروء!' : ''}`);
  }

  // ربما subtraction بدل XOR
  console.log('\n   Subtract (mod 256):');
  for (const name of dbNames) {
    const key = [...Buffer.from(name)];
    const dec = dbPwBytes.map((b, i) => (b - key[i % key.length] + 256) % 256);
    const text = Buffer.from(dec).toString('utf8');
    const printable = /^[\x20-\x7E]+$/.test(text);
    console.log(`   SUB("${name}"): [${dec.join(', ')}] → "${text}" ${printable ? '⚠️ مقروء!' : ''}`);
  }

  // Addition
  console.log('\n   Add (mod 256):');
  for (const name of dbNames) {
    const key = [...Buffer.from(name)];
    const dec = dbPwBytes.map((b, i) => (b + key[i % key.length]) % 256);
    const text = Buffer.from(dec).toString('utf8');
    const printable = /^[\x20-\x7E]+$/.test(text);
    console.log(`   ADD("${name}"): [${dec.join(', ')}] → "${text}" ${printable ? '⚠️ مقروء!' : ''}`);
  }

  // ═══ 8. هل "nullandnotempty" هو نتيجة دالة تشفير؟ ═══
  console.log('\n🔍 [8] هل "nullandnotempty" هي نتيجة تشفير لكلمة أخرى؟');
  const testWords = ['Administrator', 'admin', '11225511', '123456', 'password', 'system'];
  for (const word of testWords) {
    // Base64
    if (Buffer.from(word).toString('base64') === 'nullandnotempty') {
      console.log(`   🚨 Base64("${word}") = "nullandnotempty"!`);
    }
    // MD5 prefix
    const md5 = await pool.request().query(`SELECT LOWER(CONVERT(varchar(32), HASHBYTES('MD5', '${word}'), 2)) AS h`);
    if (md5.recordset[0].h.startsWith('nulland')) {
      console.log(`   🚨 MD5("${word}") يبدأ بـ "nulland"!`);
    }
  }

  // ═══ 9. هل يمكن أن كلمة السر مخزّنة في عمود آخر من نفس السجل؟ ═══
  console.log('\n🔍 [9] كل أعمدة Administrator في UserData:');
  const full = await pool.request().query(`SELECT * FROM UserData WHERE Us_ID = -1`);
  const adminFull = full.recordset[0];
  for (const [k, v] of Object.entries(adminFull)) {
    if (v !== null) {
      const s = String(v);
      console.log(`   ${k.padEnd(30)} = "${s}"`);
      if (s.length > 2 && s.length < 30) {
        const b64 = Buffer.from(s, 'base64').toString('utf8');
        if (/^[\x20-\x7E]+$/.test(b64) && b64.length > 2) {
          console.log(`      ↳ Base64 decode: "${b64}"`);
        }
      }
    }
  }

  // ═══ 10. BILLING_MANAGERS_USERS — كل الأعمدة لـ Administrator ═══
  console.log('\n🔍 [10] BILLING_MANAGERS_USERS — كل أعمدة Administrator:');
  const bmFull = await pool.request().query(`
    SELECT * FROM BILLING_MANAGERS_USERS WHERE USER_NO IN (-1, -2)
  `);
  for (const row of bmFull.recordset) {
    console.log(`\n   --- ${row.NAME} ---`);
    for (const [k, v] of Object.entries(row)) {
      if (v !== null) {
        console.log(`   ${k.padEnd(20)} = "${v}"`);
      }
    }
  }

  // ═══ 11. هل هناك جداول إعدادات أخرى؟ ═══
  console.log('\n🔍 [11] كل الجداول في القاعدة:');
  const allTables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME
  `);
  console.log(`   عدد الجداول: ${allTables.recordset.length}`);
  for (const t of allTables.recordset) {
    console.log(`   ${t.TABLE_NAME}`);
  }

} finally {
  await pool.close();
}

process.exit(0);
