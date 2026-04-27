/**
 * اكتشاف SQL Server login اسمه Admin_Store (أو ما يشبه)
 * + استخراج الـ password_hash
 * + محاولة كسر الهاش باستخدام SHA512 مع salt (SQL Server 2012+ format)
 */
import sql from 'mssql';
import crypto from 'crypto';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  database: 'master',
};

// SQL Server 2012+ hash format: 0x0200 + 4-byte salt + 64-byte SHA512(password_utf16le + salt)
function verifyHash(password, hashHex) {
  const hash = Buffer.from(hashHex.replace(/^0x/i, ''), 'hex');
  const version = hash.readUInt16LE(0);  // little-endian
  const salt = hash.slice(2, 6);

  if (version === 0x0200) {
    // SQL 2012+: SHA512
    const digest = hash.slice(6);
    const pwUtf16 = Buffer.from(password, 'utf16le');
    const computed = crypto.createHash('sha512').update(pwUtf16).update(salt).digest();
    return computed.equals(digest);
  } else if (version === 0x0100) {
    // SQL 2005-2008: SHA1 (case-sensitive hash + optional case-insensitive hash)
    const digest = hash.slice(6, 26); // 20 bytes SHA1
    const pwUtf16 = Buffer.from(password, 'utf16le');
    const computed = crypto.createHash('sha1').update(pwUtf16).update(salt).digest();
    return computed.equals(digest);
  }
  return false;
}

async function main() {
  const pool = new sql.ConnectionPool(CONFIG);
  await pool.connect();

  try {
    // 1. كل logins التي تحتوي admin / store / ecas
    console.log('═══ 1. كل server logins ═══');
    const allLogins = await pool.request().query(`
      SELECT name, type_desc, is_disabled, create_date, modify_date
      FROM sys.server_principals
      WHERE type IN ('S', 'U', 'G')  -- SQL, Windows user, Windows group
      ORDER BY name
    `);
    for (const r of allLogins.recordset) {
      console.log(`   ${r.name.padEnd(40)} [${r.type_desc}] created=${r.create_date?.toISOString?.() ?? r.create_date}`);
    }

    // 2. كل DB users في كل قواعد Ecas* مع كلمة admin / store
    console.log('\n═══ 2. DB users مرتبطة (من master.sys.database_principals) ═══');
    const dbsR = await pool.request().query(`
      SELECT name FROM sys.databases WHERE name LIKE 'Ecas%' OR name = 'master' ORDER BY name
    `);
    for (const db of dbsR.recordset.map(r => r.name)) {
      try {
        const r = await pool.request().query(`
          SELECT name, type_desc, create_date
          FROM [${db}].sys.database_principals
          WHERE type IN ('S', 'U') AND name NOT LIKE '##%' AND name NOT LIKE 'sys%'
          ORDER BY name
        `);
        if (r.recordset.length) {
          console.log(`\n── ${db} ──`);
          for (const u of r.recordset) {
            console.log(`   ${u.name.padEnd(40)} [${u.type_desc}]`);
          }
        }
      } catch (e) {
        console.log(`\n── ${db} ── ⚠️ ${e.message}`);
      }
    }

    // 3. استخراج الـ hash
    console.log('\n═══ 3. محاولة استخراج password_hash ═══');
    try {
      const hashR = await pool.request().query(`
        SELECT name, password_hash FROM sys.sql_logins
        WHERE name LIKE '%admin%' OR name LIKE '%store%' OR name LIKE '%ecas%' OR name LIKE '%sa%'
      `);
      if (hashR.recordset.length === 0) {
        console.log('   ⚠️  لا نتائج (صلاحية محدودة أو لا login بهذه الأسماء)');
      }
      for (const r of hashR.recordset) {
        const hashHex = r.password_hash == null
          ? null
          : '0x' + Buffer.from(r.password_hash).toString('hex');
        console.log(`\n   name: ${r.name}`);
        console.log(`   hash: ${hashHex}`);

        if (hashHex) {
          // Brute-force مع قاموس صغير
          const dict = [
            '11225511', 'mypassword4lonin', 'mypassword4login', 'nullandnotempty',
            'Administrator', 'admin', 'admin_store', 'Admin_Store', 'AdminStore',
            '123', '123123', 'Ecas@123', 'Ecas2668', 'Ecas2668@2026',
            'Ecas@9982.zuc', 'sa', 'password', 'P@ssw0rd', '12345',
            'YemenID', 'Challengers', '2026', 'Ecas', 'ECAS',
            'SabalyahEle', 'Sabalyah', 'Lit_SabalyahEle_$_2668@255',
            'AlhamRead@2026!', 'almham_reader',
            // Yemeni common
            'alabbasi', 'alabasi', 'العباسي', 'محمد', 'mohammed',
            // ECAS-related
            'ECASDEV', 'ecasdev', 'Ecas@255', 'Ecas2673',
          ];
          console.log(`   🔨 محاولة ${dict.length} كلمة من القاموس...`);
          let found = null;
          for (const pw of dict) {
            try {
              if (verifyHash(pw, hashHex)) { found = pw; break; }
            } catch {}
          }
          if (found) {
            console.log(`   ⭐⭐⭐ MATCH! password="${found}"`);
          } else {
            console.log(`   ❌ لا تطابق مع القاموس`);
          }
        }
      }
    } catch (e) {
      console.log(`   ⚠️  خطأ: ${e.message}`);
    }

    // 4. فحص أي مستخدم في قواعد Ecas* يطابق "Admin_Store"
    console.log('\n═══ 4. بحث شامل عن Admin_Store في كل قواعد Ecas* ═══');
    for (const db of dbsR.recordset.map(r => r.name)) {
      if (db === 'master') continue;
      try {
        const r = await pool.request().query(`
          SELECT name, type_desc, default_schema_name
          FROM [${db}].sys.database_principals
          WHERE name LIKE '%admin%store%' OR name LIKE '%Admin%Store%'
             OR name LIKE '%adminstore%' OR name = 'Admin_Store'
        `);
        if (r.recordset.length) {
          console.log(`\n   ${db}:`);
          for (const u of r.recordset) {
            console.log(`     ${u.name} [${u.type_desc}]`);
          }
        }
      } catch {}
    }

  } finally {
    await pool.close();
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
