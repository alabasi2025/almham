/**
 * بحث عميق عن Admin_Store في:
 *  1. كل instances على localhost
 *  2. كل قواعد البيانات (ليس بس Ecas*)
 *  3. كل الـ principals بدون filter
 *  4. البحث عن الكلمة "Admin" و "Store" في كل أعمدة كل الجداول
 */
import sql from 'mssql';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  database: 'master',
};

async function main() {
  const pool = new sql.ConnectionPool(CONFIG);
  await pool.connect();

  try {
    // 1. كل القواعد
    console.log('═══ 1. كل قواعد البيانات ═══');
    const dbs = await pool.request().query(`
      SELECT name, create_date, collation_name, state_desc
      FROM sys.databases
      ORDER BY name
    `);
    for (const d of dbs.recordset) {
      console.log(`   ${d.name.padEnd(30)} ${d.state_desc}  created=${d.create_date?.toISOString?.() ?? d.create_date}`);
    }

    // 2. كل server principals (بدون filter)
    console.log('\n═══ 2. كل server principals ═══');
    const sps = await pool.request().query(`
      SELECT name, type, type_desc, is_disabled, create_date
      FROM sys.server_principals
      ORDER BY name
    `);
    for (const p of sps.recordset) {
      console.log(`   ${p.name.padEnd(50)} [${p.type_desc}] disabled=${p.is_disabled}`);
    }

    // 3. لكل قاعدة، كل database principals
    console.log('\n═══ 3. كل database principals في كل قواعد (بدون filter) ═══');
    for (const db of dbs.recordset.map(r => r.name)) {
      try {
        const r = await pool.request().query(`
          SELECT name, type_desc, is_fixed_role, default_schema_name
          FROM [${db}].sys.database_principals
          ORDER BY name
        `);
        const filtered = r.recordset.filter(u =>
          !['public', 'dbo', 'guest', 'sys', 'INFORMATION_SCHEMA'].includes(u.name) &&
          !u.name.startsWith('db_') &&
          !u.name.startsWith('##')
        );
        if (filtered.length) {
          console.log(`\n── ${db} (${filtered.length} مستخدم غير افتراضي):`);
          for (const u of filtered) {
            console.log(`     ${u.name.padEnd(40)} [${u.type_desc}]`);
          }
        }
      } catch (e) {
        console.log(`── ${db}: ⚠️ ${e.message.substring(0, 60)}`);
      }
    }

    // 4. البحث النصّي عن "admin" في كل البيانات (في قواعد Ecas*)
    console.log('\n═══ 4. البحث عن "admin" أو "store" في بيانات الجداول ═══');
    const ecasOnlyDbs = dbs.recordset.filter(d => d.name.startsWith('Ecas')).map(d => d.name);
    for (const db of ecasOnlyDbs) {
      const tblsR = await pool.request().query(`
        SELECT TABLE_NAME FROM [${db}].INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE='BASE TABLE'
      `);
      const tblsToCheck = tblsR.recordset
        .map(r => r.TABLE_NAME)
        .filter(t => /user|login|admin|casher|cashier|manager|store/i.test(t));

      for (const tbl of tblsToCheck) {
        try {
          // خذ كل الأعمدة النصّية
          const colsR = await pool.request().query(`
            SELECT COLUMN_NAME FROM [${db}].INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tbl}' AND DATA_TYPE IN ('varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext')
          `);
          const textCols = colsR.recordset.map(c => c.COLUMN_NAME);
          if (textCols.length === 0) continue;

          // ابحث عن "admin" أو "store" في أي عمود نصّي
          const whereClauses = textCols.map(c => `[${c}] LIKE N'%admin%store%' OR [${c}] LIKE N'%Admin_Store%' OR [${c}] LIKE N'%adminstore%'`).join(' OR ');
          const r = await pool.request().query(`
            SELECT TOP 5 * FROM [${db}].dbo.[${tbl}]
            WHERE ${whereClauses}
          `);
          if (r.recordset.length) {
            console.log(`\n── ${db}.${tbl} — ${r.recordset.length} سجل يحتوي "admin_store":`);
            for (const row of r.recordset) {
              console.log(`     ${JSON.stringify(row).substring(0, 300)}`);
            }
          }
        } catch {}
      }
    }

    // 5. استعلام sys.sql_logins بكل الاحتمالات
    console.log('\n═══ 5. كل sql_logins ═══');
    try {
      const sql_logins = await pool.request().query(`
        SELECT name, sid, create_date, is_policy_checked, is_expiration_checked,
               CASE WHEN password_hash IS NULL THEN '(null)' ELSE 'BINARY(' + CAST(DATALENGTH(password_hash) AS VARCHAR) + ')' END AS hash_info
        FROM sys.sql_logins
        ORDER BY name
      `);
      for (const r of sql_logins.recordset) {
        console.log(`   ${r.name.padEnd(40)} hash=${r.hash_info}`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
    }

  } finally {
    await pool.close();
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
