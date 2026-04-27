/**
 * فحص InvStoresData — "مدير المخزن" = Admin_Store = الادمن ستور
 * + استخراج كل حقول الجدول
 * + مقارنة Strg_Admin password مع Administrator password
 */
import sql from 'mssql';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
};

async function main() {
  for (const dbName of ['Ecas2664', 'Ecas2668', 'Ecas2670', 'Ecas2673']) {
    console.log('═'.repeat(80));
    console.log(`📦 ${dbName}`);
    console.log('═'.repeat(80));

    const pool = new sql.ConnectionPool({ ...CONFIG, database: dbName });
    await pool.connect();
    try {
      // 1. كل أعمدة InvStoresData
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'InvStoresData'
        ORDER BY ORDINAL_POSITION
      `);
      console.log('\nالأعمدة:');
      for (const c of cols.recordset) {
        console.log(`  ${c.COLUMN_NAME.padEnd(35)} ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? '(' + c.CHARACTER_MAXIMUM_LENGTH + ')' : ''}`);
      }

      // 2. كل سجلات InvStoresData
      const rows = await pool.request().query(`SELECT * FROM InvStoresData`);
      console.log(`\nعدد السجلات: ${rows.recordset.length}`);
      for (const row of rows.recordset) {
        console.log('\n─── سجل ───');
        for (const [k, v] of Object.entries(row)) {
          if (v !== null && v !== '' && v !== false && v !== 0) {
            console.log(`  ${k.padEnd(30)} = ${JSON.stringify(v)}`);
          }
        }
      }
    } finally {
      await pool.close();
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
