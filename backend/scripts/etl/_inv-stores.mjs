/**
 * فحص InvStoresData وكل الجداول المتعلقة بالمخازن
 * + البحث عن user/admin/password مرتبط بالـ store
 */
import sql from 'mssql';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
};

async function main() {
  for (const dbName of ['Ecas2668', 'Ecas2673']) {
    console.log('═'.repeat(80));
    console.log(`📦 ${dbName}`);
    console.log('═'.repeat(80));

    const pool = new sql.ConnectionPool({ ...CONFIG, database: dbName });
    await pool.connect();
    try {
      // الجداول المتعلقة بالمخازن
      const storeTables = ['InvStoresData', 'InvStoreCategories', 'InvStoreCategoriesHst'];
      for (const tbl of storeTables) {
        try {
          const cols = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tbl}' ORDER BY ORDINAL_POSITION
          `);
          console.log(`\n── ${tbl} ──`);
          console.log(`  أعمدة: ${cols.recordset.map(c => c.COLUMN_NAME + '(' + c.DATA_TYPE + ')').join(', ')}`);

          const rows = await pool.request().query(`SELECT * FROM ${tbl}`);
          console.log(`  عدد السجلات: ${rows.recordset.length}`);
          for (const row of rows.recordset.slice(0, 10)) {
            console.log(`    ${JSON.stringify(row)}`);
          }
        } catch (e) {
          console.log(`  ⚠️  ${tbl}: ${e.message.substring(0, 100)}`);
        }
      }

      // بحث عن "admin" + "store" في كل مكان
      console.log(`\n── بحث عن "admin" + "store" في كل جدول ──`);
      const allTables = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'
      `);
      for (const tbl of allTables.recordset.map(r => r.TABLE_NAME)) {
        if (!/store|stor|ادمن|admin|manager|user/i.test(tbl)) continue;
        try {
          const textColsR = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tbl}' AND DATA_TYPE IN ('varchar','nvarchar','char','nchar')
          `);
          if (textColsR.recordset.length === 0) continue;
          const conds = textColsR.recordset.map(c => `[${c.COLUMN_NAME}] LIKE '%admin%' OR [${c.COLUMN_NAME}] LIKE '%Admin%'`).join(' OR ');
          const r = await pool.request().query(`SELECT TOP 10 * FROM [${tbl}] WHERE ${conds}`);
          if (r.recordset.length) {
            console.log(`\n    📌 ${tbl} (${r.recordset.length} match):`);
            for (const row of r.recordset) {
              console.log(`      ${JSON.stringify(row).substring(0, 350)}`);
            }
          }
        } catch {}
      }

      // أيضاً: كل جدول فيه عمود "Admin" أو "Store" في اسمه
      console.log(`\n── أعمدة بأسماء تحوي admin أو store ──`);
      const adminCols = await pool.request().query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE COLUMN_NAME LIKE '%admin%' OR COLUMN_NAME LIKE '%Admin%'
           OR COLUMN_NAME LIKE '%store%' OR COLUMN_NAME LIKE '%Store%'
           OR COLUMN_NAME LIKE '%Mng%' OR COLUMN_NAME LIKE '%Mgr%'
        ORDER BY TABLE_NAME
      `);
      for (const c of adminCols.recordset) {
        console.log(`    ${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE})`);
      }
    } finally {
      await pool.close();
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
