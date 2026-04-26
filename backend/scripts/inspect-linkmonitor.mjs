import sql from 'mssql';

const BASE = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
};

async function run() {
  for (const [db, label] of [['Ecas2673', 'الدهمية'], ['Ecas2668', 'الصبالية']]) {
    const pool = new sql.ConnectionPool({ ...BASE, database: db });
    await pool.connect();

    // أعمدة LinkMonitor
    const cols = await pool.request().query(
      "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'LinkMonitor' ORDER BY ORDINAL_POSITION"
    );
    if (label === 'الدهمية') {
      console.log('=== أعمدة LinkMonitor ===');
      cols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));
    }

    // بيانات
    const rows = await pool.request().query('SELECT * FROM LinkMonitor ORDER BY LnkM_ID');
    console.log(`\n=== نقاط الرصد — ${label} === (${rows.recordset.length} نقطة)`);
    rows.recordset.forEach(r => {
      console.log(`  ${r.LnkM_ID} | ${r.LnkM_Name || '-'} | مسؤول: ${r.LnkM_Employ || '-'} | عدّاد: ${r.LnkM_AdNo || '-'} | استهلاك: ${r.LnkM_Consume || 0} | مشتركين: ${r.LnkM_TotalCstNumber || 0}`);
    });

    await pool.close();
  }
}

run().catch(e => console.error('❌', e.message));
