import sql from 'mssql';

const DBS = [
  { name: 'Ecas2673', label: 'الدهمية' },
  { name: 'Ecas2668', label: 'الصبالية' },
  { name: 'Ecas2672', label: 'غليل' },
];

const BASE = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
};

async function run() {
  // أولاً: هيكل الجداول من أول قاعدة
  const pool0 = new sql.ConnectionPool({ ...BASE, database: 'Ecas2673' });
  await pool0.connect();

  for (const tbl of ['LinkPoint', 'Squares', 'LinkMonitor', 'TransFormer']) {
    const cols = await pool0.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tbl}' ORDER BY ORDINAL_POSITION`
    );
    if (cols.recordset.length === 0) {
      console.log(`\n=== ${tbl} — غير موجود ===`);
    } else {
      console.log(`\n=== ${tbl} — ${cols.recordset.length} عمود ===`);
      cols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));
    }
  }
  await pool0.close();

  // ثانياً: بيانات كل محطة
  for (const db of DBS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 ${db.label} (${db.name})`);
    console.log('='.repeat(60));

    const pool = new sql.ConnectionPool({ ...BASE, database: db.name });
    await pool.connect();

    // الفيدرات
    const feeders = await pool.request().query('SELECT LnkP_ID, LnkP_Name, LnkP_Employ, LnkP_Consume, LnkP_TotalCstNumber, LnkP_TotalCstStoped, LnkP_LostPowerToCstHaveRead FROM LinkPoint ORDER BY LnkP_ID');
    console.log(`\n🔌 الفيدرات: ${feeders.recordset.length}`);
    feeders.recordset.forEach(r => {
      console.log(`  ${r.LnkP_ID} | ${r.LnkP_Name} | مسؤول: ${r.LnkP_Employ || '-'} | مشتركين: ${r.LnkP_TotalCstNumber} | موقوفين: ${r.LnkP_TotalCstStoped} | استهلاك: ${r.LnkP_Consume} | فاقد: ${r.LnkP_LostPowerToCstHaveRead}`);
    });

    // نقاط الرصد
    try {
      const monitors = await pool.request().query('SELECT * FROM LinkMonitor ORDER BY LnkM_ID');
      console.log(`\n📡 نقاط الرصد (LinkMonitor): ${monitors.recordset.length}`);
      if (monitors.recordset.length > 0) {
        monitors.recordset.forEach(r => {
          const name = r.LnkM_Name || r.LnkM_ID;
          console.log(`  ${r.LnkM_ID} | ${name}`);
        });
      }
    } catch (e) {
      console.log(`\n📡 نقاط الرصد: خطأ — ${e.message}`);
    }

    // المربعات — أول 10 لها اسم
    const squares = await pool.request().query("SELECT Squr_ID, Squr_Name, Squr_CashierName, Squr_TotalCstNumber, Squr_Consume FROM Squares WHERE Squr_Name IS NOT NULL AND Squr_Name <> '0' ORDER BY Squr_ID");
    console.log(`\n📦 المربعات/الطبلات (لها اسم): ${squares.recordset.length}`);
    squares.recordset.slice(0, 10).forEach(r => {
      console.log(`  ${r.Squr_ID} | ${r.Squr_Name} | كاشف: ${r.Squr_CashierName || '-'} | مشتركين: ${r.Squr_TotalCstNumber} | استهلاك: ${r.Squr_Consume}`);
    });
    if (squares.recordset.length > 10) console.log(`  ... و ${squares.recordset.length - 10} أخرى`);

    // ربط فيدر ← مربع عبر المشتركين
    const feederSquares = await pool.request().query(`
      SELECT c.LnkP_ID, lp.LnkP_Name, c.Squr_ID, s.Squr_Name, COUNT(*) as cnt
      FROM Customer c
      JOIN LinkPoint lp ON c.LnkP_ID = lp.LnkP_ID
      JOIN Squares s ON c.Squr_ID = s.Squr_ID
      WHERE c.RS_ID = 1
      GROUP BY c.LnkP_ID, lp.LnkP_Name, c.Squr_ID, s.Squr_Name
      ORDER BY c.LnkP_ID, cnt DESC
    `);
    console.log(`\n🔗 ربط فيدر ↔ طبلة (عبر المشتركين النشطين): ${feederSquares.recordset.length} ربط`);
    
    // ملخص: كم طبلة لكل فيدر
    const feederSummary = {};
    feederSquares.recordset.forEach(r => {
      if (!feederSummary[r.LnkP_ID]) feederSummary[r.LnkP_ID] = { name: r.LnkP_Name, panels: 0, subscribers: 0 };
      feederSummary[r.LnkP_ID].panels++;
      feederSummary[r.LnkP_ID].subscribers += r.cnt;
    });
    console.log(`\n📊 ملخص: فيدر → عدد الطبلات → عدد المشتركين النشطين`);
    Object.entries(feederSummary).forEach(([id, s]) => {
      console.log(`  ${id} | ${s.name} | ${s.panels} طبلة | ${s.subscribers} مشترك`);
    });

    await pool.close();
  }
}

run().catch(e => console.error('❌', e.message));
