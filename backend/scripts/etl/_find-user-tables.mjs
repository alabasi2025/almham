/**
 * بحث شامل عن كل الجداول والأعمدة المتعلّقة بالمستخدمين/تسجيل الدخول في ECAS
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

async function main() {
  for (const { code, label } of ECAS_DATABASES) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📦  قاعدة ${code} — ${label}`);
    console.log('═'.repeat(80));

    const mssql = await mssqlPool(code);
    try {
      // 1. كل الجداول التي تحتوي كلمة User أو Login أو Pass أو Employee أو Manager أو Staff
      console.log('\n🔍 جداول فيها (User/Login/Pass/Employee/Manager/Staff/Auth/Member):');
      const tables = await mssql.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND (
            TABLE_NAME LIKE '%user%'
            OR TABLE_NAME LIKE '%login%'
            OR TABLE_NAME LIKE '%pass%'
            OR TABLE_NAME LIKE '%employee%'
            OR TABLE_NAME LIKE '%manager%'
            OR TABLE_NAME LIKE '%staff%'
            OR TABLE_NAME LIKE '%auth%'
            OR TABLE_NAME LIKE '%member%'
            OR TABLE_NAME LIKE '%rank%'
            OR TABLE_NAME LIKE '%account%'
          )
        ORDER BY TABLE_NAME
      `);
      for (const row of tables.recordset) {
        const t = row.TABLE_NAME;
        const c = await mssql.request().query(`SELECT COUNT(*) AS c FROM [${t}]`);
        console.log(`   - ${t.padEnd(45)} (${c.recordset[0].c} سجل)`);
      }

      // 2. كل الأعمدة التي اسمها فيه User أو Pass أو Login أو Code أو PW
      console.log('\n🔍 أعمدة فيها (User/Pass/Login/PW/Code/Auth):');
      const cols = await mssql.request().query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE (
          COLUMN_NAME LIKE '%user%'
          OR COLUMN_NAME LIKE '%pass%'
          OR COLUMN_NAME LIKE '%login%'
          OR COLUMN_NAME LIKE '%_pw%'
          OR COLUMN_NAME LIKE 'pw_%'
        )
        ORDER BY TABLE_NAME, COLUMN_NAME
      `);
      const byTable = new Map();
      for (const row of cols.recordset) {
        if (!byTable.has(row.TABLE_NAME)) byTable.set(row.TABLE_NAME, []);
        byTable.get(row.TABLE_NAME).push(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
      }
      for (const [t, list] of byTable) {
        console.log(`   📌 ${t}:`);
        for (const c of list) console.log(`      - ${c}`);
      }

      // 3. جدول RankUser
      if (byTable.has('RankUser') || (await mssql.request()
        .input('t', 'RankUser').query(`SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t`)).recordset[0].c > 0) {
        console.log('\n📋 محتوى RankUser (كامل):');
        const r = await mssql.request().query(`SELECT TOP 50 * FROM RankUser`);
        for (const row of r.recordset) {
          console.log('   ', JSON.stringify(row));
        }
      }
    } finally {
      await mssql.close();
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
