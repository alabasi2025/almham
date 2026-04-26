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

  // 1. كل أعمدة جدول Customer
  const cols = await pool.request().query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Customer' ORDER BY ORDINAL_POSITION"
  );
  console.log('=== كل أعمدة جدول Customer (المشترك + العدّاد) ===');
  cols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

  // 2. مشترك واحد كامل كعيّنة
  console.log('\n=== عيّنة مشترك واحد (كل الحقول) ===');
  const sample = await pool.request().query('SELECT TOP 1 * FROM Customer WHERE RS_ID = 1 AND Cst_AdNo IS NOT NULL');
  if (sample.recordset[0]) {
    const s = sample.recordset[0];
    for (const [key, val] of Object.entries(s)) {
      console.log(`  ${key}: ${val}`);
    }
  }

  // 3. أنواع العدّادات
  console.log('\n=== أنواع العدّادات (AdadType) ===');
  const types = await pool.request().query('SELECT * FROM AdadType ORDER BY AdTp_ID');
  types.recordset.forEach(r => console.log(`  ${r.AdTp_ID} | ${r.AdTp_Name} | معامل: ${r.AdTp_Value} | رمز: ${r.AdTp_ShortName}`));

  // 4. أنواع الأطوار
  console.log('\n=== أنواع الأطوار (FazType) ===');
  const faz = await pool.request().query('SELECT * FROM FazType ORDER BY FT_ID');
  faz.recordset.forEach(r => console.log(`  ${r.FT_ID} | ${r.FT_Name}`));

  // 5. إحصائية أنواع العدّادات
  console.log('\n=== توزيع أنواع العدّادات (الدهمية — نشطين فقط) ===');
  const dist = await pool.request().query(`
    SELECT at2.AdTp_Name, COUNT(*) as cnt
    FROM Customer c
    JOIN AdadType at2 ON c.AdTp_ID = at2.AdTp_ID
    WHERE c.RS_ID = 1
    GROUP BY at2.AdTp_Name
    ORDER BY cnt DESC
  `);
  dist.recordset.forEach(r => console.log(`  ${r.AdTp_Name}: ${r.cnt}`));

  // 6. إحصائية الأطوار
  console.log('\n=== توزيع الأطوار (الدهمية — نشطين فقط) ===');
  const fazDist = await pool.request().query(`
    SELECT ft.FT_Name, COUNT(*) as cnt
    FROM Customer c
    JOIN FazType ft ON c.FT_ID = ft.FT_ID
    WHERE c.RS_ID = 1
    GROUP BY ft.FT_Name
    ORDER BY cnt DESC
  `);
  fazDist.recordset.forEach(r => console.log(`  ${r.FT_Name}: ${r.cnt}`));

  // 7. حقول العدّاد الإضافية (معامل ضرب، أحمال، تأمين، GPS)
  console.log('\n=== عيّنة 5 مشتركين — حقول العدّاد التفصيلية ===');
  const meters = await pool.request().query(`
    SELECT TOP 5 c.Cst_ID, c.Cst_Name, c.Cst_AdNo, c.Cst_AdFild, c.Cst_AdTor,
           c.Cst_Loads, c.Cst_Insurance, c.Cst_MF,
           c.Cst_LastRead, c.Cst_CurrentRead,
           c.Cst_LastSales, c.Cst_LastArrears, c.Cst_LastBalance,
           c.Cst_GPS_LAT, c.Cst_GPS_LNG,
           c.Cst_BeginServceDate, c.Cst_CountNo,
           c.Bill_IsSendSMS, c.Bill_IsSendWtsAp
    FROM Customer c
    WHERE c.RS_ID = 1 AND c.Cst_AdNo IS NOT NULL
    ORDER BY c.Cst_ID
  `);
  meters.recordset.forEach(r => {
    console.log(`\n  --- ${r.Cst_ID} | ${r.Cst_Name} ---`);
    console.log(`    رقم العدّاد: ${r.Cst_AdNo}`);
    console.log(`    خانات العدّاد: ${r.Cst_AdFild}`);
    console.log(`    طور العدّاد: ${r.Cst_AdTor}`);
    console.log(`    معامل الضرب: ${r.Cst_MF}`);
    console.log(`    الأحمال: ${r.Cst_Loads}`);
    console.log(`    التأمين: ${r.Cst_Insurance}`);
    console.log(`    رقم خط السير: ${r.Cst_CountNo}`);
    console.log(`    آخر قراءة: ${r.Cst_LastRead} | القراءة الحالية: ${r.Cst_CurrentRead}`);
    console.log(`    آخر مبيعات: ${r.Cst_LastSales} | متأخرات: ${r.Cst_LastArrears} | رصيد: ${r.Cst_LastBalance}`);
    console.log(`    GPS: ${r.Cst_GPS_LAT || '-'}, ${r.Cst_GPS_LNG || '-'}`);
    console.log(`    تاريخ بدء الخدمة: ${r.Cst_BeginServceDate}`);
    console.log(`    SMS: ${r.Bill_IsSendSMS} | واتساب: ${r.Bill_IsSendWtsAp}`);
  });

  await pool.close();
}

run().catch(e => console.error('❌', e.message));
