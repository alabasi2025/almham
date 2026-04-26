import sql from 'mssql';

const BASE = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
};

async function run() {
  const pool = new sql.ConnectionPool({ ...BASE, database: 'Ecas2673' });
  await pool.connect();

  // 1. اختر طبلة فيها مشتركين
  const topPanels = await pool.request().query(`
    SELECT TOP 5 s.Squr_ID, s.Squr_Name, s.Squr_CashierName,
           COUNT(c.Cst_ID) as cst_count
    FROM Squares s
    JOIN Customer c ON c.Squr_ID = s.Squr_ID
    WHERE c.RS_ID = 1 AND s.Squr_Name IS NOT NULL AND s.Squr_Name <> '0'
    GROUP BY s.Squr_ID, s.Squr_Name, s.Squr_CashierName
    ORDER BY COUNT(c.Cst_ID) DESC
  `);

  console.log('=== أكبر 5 طبلات في الدهمية (بعدد المشتركين النشطين) ===\n');

  for (const p of topPanels.recordset) {
    console.log(`\n📦 طبلة: ${p.Squr_Name} (كود ${p.Squr_ID}) — كاشف: ${p.Squr_CashierName} — ${p.cst_count} مشترك`);
    console.log('─'.repeat(70));

    // المشتركين داخل هذه الطبلة
    const subscribers = await pool.request()
      .input('sqId', sql.Int, p.Squr_ID)
      .query(`
        SELECT c.Cst_ID, c.Cst_Name, c.Cst_Address, c.Cst_AdNo,
               c.Cst_TeleNo, c.Cst_LastRead, c.Cst_LastBalance,
               ft.FT_Name, at2.AdTp_Name,
               lp.LnkP_Name
        FROM Customer c
        LEFT JOIN FazType ft ON c.FT_ID = ft.FT_ID
        LEFT JOIN AdadType at2 ON c.AdTp_ID = at2.AdTp_ID
        LEFT JOIN LinkPoint lp ON c.LnkP_ID = lp.LnkP_ID
        WHERE c.Squr_ID = @sqId AND c.RS_ID = 1
        ORDER BY c.Cst_ID
      `);

    subscribers.recordset.forEach(s => {
      console.log(`  ${s.Cst_ID} | ${s.Cst_Name} | ${s.Cst_Address || '-'} | عدّاد: ${s.Cst_AdNo || '-'} (${s.AdTp_Name || '-'}) | ${s.FT_Name || '-'} | هاتف: ${s.Cst_TeleNo || '-'} | آخر قراءة: ${s.Cst_LastRead} | رصيد: ${s.Cst_LastBalance} | فيدر: ${s.LnkP_Name}`);
    });
  }

  // 2. ملخص عام
  const summary = await pool.request().query(`
    SELECT 
      (SELECT COUNT(*) FROM LinkPoint) as feeders,
      (SELECT COUNT(*) FROM Squares) as panels,
      (SELECT COUNT(*) FROM Customer WHERE RS_ID = 1) as active_subscribers,
      (SELECT COUNT(*) FROM Customer WHERE RS_ID = 2) as stopped_subscribers,
      (SELECT COUNT(DISTINCT Squr_ID) FROM Customer WHERE RS_ID = 1) as panels_with_subscribers
  `);
  const s = summary.recordset[0];
  console.log('\n\n=== ملخص الدهمية ===');
  console.log(`  فيدرات: ${s.feeders}`);
  console.log(`  طبلات (إجمالي): ${s.panels}`);
  console.log(`  طبلات فيها مشتركين نشطين: ${s.panels_with_subscribers}`);
  console.log(`  مشتركين نشطين: ${s.active_subscribers}`);
  console.log(`  مشتركين موقوفين: ${s.stopped_subscribers}`);

  await pool.close();
}

run().catch(e => console.error('❌', e.message));
