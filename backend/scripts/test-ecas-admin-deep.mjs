/**
 * 🔐 بحث عميق عن كلمة سر Administrator في كل مكان ممكن
 */
import sql from 'mssql';

const ECAS_DBS = ['Ecas2673', 'Ecas2668'];

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

function isPrintable(s) {
  return s.length > 0 && /^[\x20-\x7E\u0600-\u06FF]+$/.test(s);
}

for (const dbName of ECAS_DBS) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📦 ${dbName}`);
  console.log('═'.repeat(70));

  const pool = await getPool(dbName);
  try {

    // ═══ 1. UserData — فحص كامل بكل الأنواع ═══
    console.log('\n🔍 [1] UserData — Administrator (Us_ID=-1):');
    const udCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UserData' ORDER BY ORDINAL_POSITION
    `);
    console.log('   أعمدة: ' + udCols.recordset.map(c => `${c.COLUMN_NAME}(${c.DATA_TYPE})`).join(', '));

    const admin = await pool.request().query(`
      SELECT * FROM UserData WHERE Us_ID = -1
    `);
    if (admin.recordset.length > 0) {
      const row = admin.recordset[0];
      for (const [key, val] of Object.entries(row)) {
        if (val === null) continue;
        const buf = Buffer.isBuffer(val) ? val : Buffer.from(String(val));
        const display = buf.length > 100 ? `[${buf.length} bytes]` : String(val);
        console.log(`   ${key.padEnd(30)} = ${display}`);
        if (/pass|pwd|key|secret|crypt/i.test(key)) {
          console.log(`      → hex: ${buf.toString('hex')}`);
          console.log(`      → bytes: [${[...buf].join(', ')}]`);
          try { console.log(`      → base64 decode: "${Buffer.from(String(val), 'base64').toString('utf8')}"`); } catch {}
        }
      }
    }

    // فحص varbinary لكل الأعمدة
    console.log('\n   📦 فحص binary لكل الأعمدة:');
    for (const col of udCols.recordset) {
      try {
        const r = await pool.request().query(`
          SELECT CAST([${col.COLUMN_NAME}] AS varbinary(MAX)) AS bin_val,
                 DATALENGTH([${col.COLUMN_NAME}]) AS dlen
          FROM UserData WHERE Us_ID = -1
        `);
        if (r.recordset[0]?.bin_val) {
          const buf = Buffer.from(r.recordset[0].bin_val);
          if (buf.length > 0 && buf.length < 200) {
            const hex = buf.toString('hex');
            const text = buf.toString('utf8');
            const isPassCol = /pass|pwd/i.test(col.COLUMN_NAME);
            if (isPassCol) {
              console.log(`   🎯 ${col.COLUMN_NAME}: hex=${hex} text="${text}" len=${buf.length}`);
            }
          }
        }
      } catch {}
    }

    // ═══ 2. BILLING_MANAGERS_USERS — فحص كامل ═══
    console.log('\n🔍 [2] BILLING_MANAGERS_USERS — Administrator:');
    const bmCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='BILLING_MANAGERS_USERS' ORDER BY ORDINAL_POSITION
    `);
    console.log('   أعمدة: ' + bmCols.recordset.map(c => `${c.COLUMN_NAME}(${c.DATA_TYPE})`).join(', '));

    const bmAdmin = await pool.request().query(`
      SELECT * FROM BILLING_MANAGERS_USERS WHERE NAME LIKE '%Administrator%' OR USER_NO IN (-1, -2)
    `);
    for (const row of bmAdmin.recordset) {
      console.log(`\n   --- ${row.NAME} (USER_NO=${row.USER_NO}) ---`);
      for (const [key, val] of Object.entries(row)) {
        if (val === null) continue;
        const buf = Buffer.isBuffer(val) ? val : Buffer.from(String(val));
        console.log(`   ${key.padEnd(20)} = "${String(val).substring(0, 80)}" (hex:${buf.toString('hex').substring(0, 60)})`);
      }
    }

    // ═══ 3. CompInfoAndSysOption ═══
    console.log('\n🔍 [3] CompInfoAndSysOption:');
    try {
      const opts = await pool.request().query(`SELECT * FROM CompInfoAndSysOption`);
      for (const row of opts.recordset) {
        for (const [key, val] of Object.entries(row)) {
          if (val === null) continue;
          if (/pass|pwd|key|secret|crypt|admin|user|login/i.test(key)) {
            const buf = Buffer.isBuffer(val) ? val : Buffer.from(String(val));
            console.log(`   🎯 ${key} = "${String(val)}" hex:${buf.toString('hex').substring(0, 80)}`);
          }
        }
      }
    } catch (e) { console.log(`   خطأ: ${e.message}`); }

    // ═══ 4. DB_And_Sys_Info ═══
    console.log('\n🔍 [4] DB_And_Sys_Info:');
    try {
      // فحص بنية الجدول
      const diCols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME='DB_And_Sys_Info' ORDER BY ORDINAL_POSITION
      `);
      console.log('   أعمدة: ' + diCols.recordset.map(c => `${c.COLUMN_NAME}(${c.DATA_TYPE})`).join(', '));

      const di = await pool.request().query(`SELECT * FROM DB_And_Sys_Info`);
      for (const row of di.recordset) {
        for (const [key, val] of Object.entries(row)) {
          if (val === null) continue;
          const buf = Buffer.isBuffer(val) ? val : Buffer.from(String(val));
          if (/pass|pwd|key|admin|user|login/i.test(key) || buf.length < 50) {
            console.log(`   ${key.padEnd(30)} = "${String(val).substring(0, 60)}" hex:${buf.toString('hex').substring(0, 80)}`);
          }
        }
      }

      // varbinary لحقل DB_PassWord
      console.log('\n   📦 DB_PassWord as varbinary:');
      const binPw = await pool.request().query(`
        SELECT CAST(DB_PassWord AS varbinary(MAX)) AS pw_bin, DATALENGTH(DB_PassWord) AS dlen
        FROM DB_And_Sys_Info
      `);
      for (const row of binPw.recordset) {
        if (row.pw_bin) {
          const buf = Buffer.from(row.pw_bin);
          console.log(`   hex: ${buf.toString('hex')}`);
          console.log(`   bytes: [${[...buf].join(', ')}]`);
          console.log(`   len: ${row.dlen}`);

          // محاولة XOR مع مفاتيح شائعة
          const bytes = [...buf];
          console.log('\n   محاولات فك:');

          // XOR byte واحد
          for (let k = 0; k < 256; k++) {
            const decoded = bytes.map(b => b ^ k);
            const text = Buffer.from(decoded).toString('utf8');
            if (isPrintable(text)) {
              console.log(`      XOR(0x${k.toString(16).padStart(2,'0')}) → "${text}"`);
            }
          }

          // XOR مع كلمات مفتاحية
          const keys = ['ECAS', 'ecas', 'Admin', 'admin', 'Ecas2673', 'Ecas2668',
            'HexCell', 'hexcell', '123456', 'password', 'sa', 'master', dbName];
          for (const key of keys) {
            const kb = [...Buffer.from(key)];
            const decoded = bytes.map((b, i) => b ^ kb[i % kb.length]);
            const text = Buffer.from(decoded).toString('utf8');
            if (isPrintable(text)) {
              console.log(`      XOR("${key}") → "${text}"`);
            }
          }

          // Base64
          try {
            const b64 = Buffer.from(buf.toString('utf8'), 'base64');
            if (b64.length > 0) console.log(`      Base64 → hex:${b64.toString('hex')} text:"${b64.toString('utf8')}"`);
          } catch {}
        }
      }
    } catch (e) { console.log(`   خطأ: ${e.message}`); }

    // ═══ 5. Branch ═══
    console.log('\n🔍 [5] Branch (Brn_DBPassWord):');
    try {
      const br = await pool.request().query(`
        SELECT Brn_ID, Brn_Name, Brn_DBName,
               Brn_DBPassWord,
               CAST(Brn_DBPassWord AS varbinary(MAX)) AS pw_bin,
               DATALENGTH(Brn_DBPassWord) AS dlen
        FROM Branch
      `);
      for (const row of br.recordset) {
        console.log(`   Branch ${row.Brn_ID}: ${row.Brn_Name} (${row.Brn_DBName})`);
        if (row.pw_bin) {
          const buf = Buffer.from(row.pw_bin);
          console.log(`      hex: ${buf.toString('hex')}`);
          console.log(`      bytes: [${[...buf].join(', ')}]`);
          console.log(`      len: ${row.dlen}`);
        }
      }
    } catch (e) { console.log(`   خطأ: ${e.message}`); }

    // ═══ 6. بحث شامل: أي جدول يحتوي "Administrator" أو كلمة سر ═══
    console.log('\n🔍 [6] بحث شامل في كل الجداول عن أعمدة كلمات السر:');
    const allPwCols = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%Pass%' OR COLUMN_NAME LIKE '%pwd%'
         OR COLUMN_NAME LIKE '%secret%' OR COLUMN_NAME LIKE '%crypt%'
         OR COLUMN_NAME LIKE '%hash%' OR COLUMN_NAME LIKE '%token%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    for (const { TABLE_NAME, COLUMN_NAME, DATA_TYPE } of allPwCols.recordset) {
      console.log(`   ${TABLE_NAME}.${COLUMN_NAME} (${DATA_TYPE})`);
      try {
        const sample = await pool.request().query(`
          SELECT TOP 3 CAST([${COLUMN_NAME}] AS varchar(MAX)) AS val,
                       DATALENGTH([${COLUMN_NAME}]) AS dlen
          FROM [${TABLE_NAME}]
          WHERE [${COLUMN_NAME}] IS NOT NULL
        `);
        for (const s of sample.recordset) {
          console.log(`      val="${String(s.val).substring(0, 60)}" (${s.dlen} bytes)`);
        }
      } catch {}
    }

    // ═══ 7. فحص sa و login على مستوى SQL Server ═══
    console.log('\n🔍 [7] SQL Server logins:');
    try {
      const logins = await pool.request().query(`
        SELECT name, type_desc, create_date, modify_date, is_disabled
        FROM sys.server_principals
        WHERE type IN ('S', 'U')
        ORDER BY name
      `);
      for (const l of logins.recordset) {
        console.log(`   ${l.name.padEnd(30)} ${l.type_desc} disabled=${l.is_disabled}`);
      }
    } catch (e) { console.log(`   ${e.message}`); }

  } finally {
    await pool.close();
  }
}

console.log('\n' + '═'.repeat(70));
console.log('✅ انتهى البحث الشامل');
console.log('═'.repeat(70));
process.exit(0);
