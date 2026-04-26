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

  // 1. كل الجداول وأحجامها
  console.log('=== كل جداول الدهمية (Ecas2673) ===\n');
  const tables = await pool.request().query(`
    SELECT t.TABLE_NAME,
           (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) as col_count
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY t.TABLE_NAME
  `);

  for (const tbl of tables.recordset) {
    try {
      const cnt = await pool.request().query(`SELECT COUNT(*) as c FROM [${tbl.TABLE_NAME}]`);
      const rows = cnt.recordset[0].c;
      const mark = rows > 0 ? '✅' : '⬜';
      console.log(`  ${mark} ${tbl.TABLE_NAME.padEnd(35)} ${String(rows).padStart(6)} صف | ${tbl.col_count} عمود`);
    } catch {
      console.log(`  ❌ ${tbl.TABLE_NAME.padEnd(35)} خطأ في القراءة`);
    }
  }

  // 2. الجداول اللي ما استعرضناها بعد
  console.log('\n\n=== جداول لم نستعرضها بعد ===\n');

  // Segel (السجلات)
  console.log('--- Segel (السجلات / حروف القراءة) ---');
  const segel = await pool.request().query('SELECT * FROM Segel ORDER BY Sgl_ID');
  segel.recordset.forEach(r => console.log(`  ${r.Sgl_ID} | ${r.Sgl_Name}`));

  // Area (المناطق)
  console.log('\n--- Area (المناطق) ---');
  const area = await pool.request().query('SELECT * FROM Area ORDER BY Ar_ID');
  area.recordset.forEach(r => console.log(`  ${r.Ar_ID} | ${r.Ar_Name}`));

  // Branch (الفروع)
  console.log('\n--- Branch (الفروع) ---');
  const branch = await pool.request().query('SELECT * FROM Branch ORDER BY Brn_ID');
  branch.recordset.forEach(r => console.log(`  ${r.Brn_ID} | ${r.Brn_Name} | ${r.Brn_AddressAndTele || ''}`));

  // RecordState (حالات السجل)
  console.log('\n--- RecordState (حالات المشترك) ---');
  const rs = await pool.request().query('SELECT * FROM RecordState ORDER BY RS_ID');
  rs.recordset.forEach(r => console.log(`  ${r.RS_ID} | ${r.RS_Name}`));

  // NewSliceDetail (شرائح التسعير)
  console.log('\n--- NewSliceDetail (شرائح التسعير) — أول 10 ---');
  const slices = await pool.request().query('SELECT TOP 10 * FROM NewSliceDetail ORDER BY Tsm_ID');
  const sliceCols = Object.keys(slices.recordset[0] || {});
  console.log(`  أعمدة: ${sliceCols.join(', ')}`);
  slices.recordset.forEach(r => console.log(`  ${r.Tsm_ID} | ${r.Tsm_Name || '-'} | سعر: ${r.Tsm_Price || '-'}`));

  // PersonInfo
  console.log('\n--- PersonInfo (أشخاص) ---');
  const persons = await pool.request().query('SELECT * FROM PersonInfo');
  persons.recordset.forEach(r => {
    const name = r.Pers_Name || r.Prs_Name || Object.values(r).find(v => typeof v === 'string' && v.length > 2) || JSON.stringify(r);
    console.log(`  ${JSON.stringify(r)}`);
  });

  // CompInfoAndSysOption
  console.log('\n--- CompInfoAndSysOption (معلومات الشركة) ---');
  const comp = await pool.request().query('SELECT TOP 1 * FROM CompInfoAndSysOption');
  if (comp.recordset[0]) {
    for (const [k, v] of Object.entries(comp.recordset[0])) {
      if (v !== null && v !== '' && v !== 0 && v !== false) {
        console.log(`  ${k}: ${v}`);
      }
    }
  }

  // BillAndRaedData (عدد + آخر فترة)
  console.log('\n--- BillAndRaedData (الفواتير والقراءات) ---');
  const bills = await pool.request().query(`
    SELECT COUNT(*) as total,
           MAX(Dt_ID) as lastPeriod,
           MIN(Dt_ID) as firstPeriod,
           COUNT(DISTINCT Dt_ID) as periods,
           COUNT(DISTINCT Cst_ID) as subscribers
    FROM BillAndRaedData
  `);
  const b = bills.recordset[0];
  console.log(`  إجمالي السجلات: ${b.total}`);
  console.log(`  أول فترة: ${b.firstPeriod}`);
  console.log(`  آخر فترة: ${b.lastPeriod}`);
  console.log(`  عدد الفترات: ${b.periods}`);
  console.log(`  عدد المشتركين: ${b.subscribers}`);

  // PaymentData (عدد + آخر دفعة)
  console.log('\n--- PaymentData (الدفعات) ---');
  const pays = await pool.request().query(`
    SELECT COUNT(*) as total,
           MAX(Pay_PaymentDate) as lastPay,
           MIN(Pay_PaymentDate) as firstPay,
           SUM(Pay_Mony) as totalAmount,
           COUNT(DISTINCT Cst_ID) as subscribers
    FROM PaymentData
  `);
  const p = pays.recordset[0];
  console.log(`  إجمالي الدفعات: ${p.total}`);
  console.log(`  أول دفعة: ${p.firstPay}`);
  console.log(`  آخر دفعة: ${p.lastPay}`);
  console.log(`  إجمالي المبالغ: ${p.totalAmount}`);
  console.log(`  عدد المشتركين: ${p.subscribers}`);

  // DB_And_Sys_Info
  console.log('\n--- DB_And_Sys_Info ---');
  const dbInfo = await pool.request().query('SELECT * FROM DB_And_Sys_Info');
  dbInfo.recordset.forEach(r => {
    for (const [k, v] of Object.entries(r)) {
      if (v !== null && v !== '') console.log(`  ${k}: ${v}`);
    }
  });

  await pool.close();
}

run().catch(e => console.error('❌', e.message));
