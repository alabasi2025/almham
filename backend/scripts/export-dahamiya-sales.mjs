#!/usr/bin/env node
/**
 * Export Dahamiya sales/collections per billing period to Excel-ready CSV.
 * Output: d:\almham\exports\dahamiya-sales-per-period.csv
 */
import sql from 'mssql';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', '..', 'exports', 'dahamiya-sales-per-period.csv');

const config = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  database: 'Ecas2673',
  options: {
    instanceName: 'ECASDEV',
    trustServerCertificate: true,
    encrypt: false,
  },
  connectionTimeout: 15_000,
  requestTimeout: 60_000,
};

const SQL_QUERY = `
SELECT
  dt.Dt_ID AS periodId,
  dt.Yr_ID AS year,
  dt.Mon_ID AS month,
  dt.Dt_Name AS periodName,
  CONVERT(NVARCHAR(10), dt.Dt_FromDate, 23) AS fromDate,
  CONVERT(NVARCHAR(10), dt.Dt_ToDate, 23) AS toDate,
  ISNULL(b.Bills, 0) AS bills,
  ISNULL(b.Kwh, 0) AS kwh,
  ISNULL(b.Sales, 0) AS sales,
  ISNULL(p.PayCount, 0) AS payCount,
  ISNULL(p.Collected, 0) AS collected,
  ISNULL(t.Taswih, 0) AS adjustments
FROM DateTable dt
LEFT JOIN (
  SELECT Dt_ID, COUNT(*) AS Bills,
    CAST(SUM(Cst_MonthConsume) AS INT) AS Kwh,
    CAST(SUM(Cst_ConsumePrice + ISNULL(Cst_ConsumeAddedPrice,0)) AS DECIMAL(20,0)) AS Sales
  FROM BillAndRaedDataHistorical GROUP BY Dt_ID
) b ON b.Dt_ID = dt.Dt_ID
LEFT JOIN (
  SELECT Dt_ID, COUNT(*) AS PayCount,
    CAST(SUM(Pay_Mony) AS DECIMAL(20,0)) AS Collected
  FROM PaymentDataHistorical GROUP BY Dt_ID
) p ON p.Dt_ID = dt.Dt_ID
LEFT JOIN (
  SELECT Dt_ID, CAST(SUM(TwBd_TaswihValue) AS DECIMAL(20,0)) AS Taswih
  FROM TswBasicData GROUP BY Dt_ID
) t ON t.Dt_ID = dt.Dt_ID
ORDER BY dt.Dt_ID
`;

/** Escape a value for CSV (RFC 4180 + double-quote). */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  console.log('Connecting to localhost\\ECASDEV → Ecas2673 ...');
  const pool = await sql.connect(config);
  const result = await pool.request().query(SQL_QUERY);
  const rows = result.recordset;
  console.log(`Fetched ${rows.length} periods.`);

  const headers = [
    'رقم الفترة',
    'السنة',
    'الشهر',
    'اسم الفترة',
    'من تاريخ',
    'إلى تاريخ',
    'عدد الفواتير',
    'الاستهلاك كيلوواط',
    'إجمالي المبيعات',
    'عدد التسديدات',
    'إجمالي التحصيل',
    'التسويات',
    'الفرق (مبيعات - تحصيل)',
  ];

  const lines = [headers.map(csvCell).join(',')];
  let totSales = 0, totCollected = 0, totAdj = 0, totKwh = 0, totBills = 0, totPays = 0;
  for (const r of rows) {
    const sales = Number(r.sales ?? 0);
    const collected = Number(r.collected ?? 0);
    const adj = Number(r.adjustments ?? 0);
    const diff = sales - collected;
    totSales += sales;
    totCollected += collected;
    totAdj += adj;
    totKwh += Number(r.kwh ?? 0);
    totBills += Number(r.bills ?? 0);
    totPays += Number(r.payCount ?? 0);

    lines.push([
      r.periodId,
      r.year,
      r.month,
      r.periodName,
      r.fromDate ?? '',
      r.toDate ?? '',
      r.bills,
      r.kwh,
      sales,
      r.payCount,
      collected,
      adj,
      diff,
    ].map(csvCell).join(','));
  }

  lines.push('');
  lines.push(['', '', '', 'الإجمالي', '', '', totBills, totKwh, totSales, totPays, totCollected, totAdj, totSales - totCollected].map(csvCell).join(','));

  // UTF-8 BOM so Excel opens Arabic correctly
  const bom = '\uFEFF';
  writeFileSync(OUT_PATH, bom + lines.join('\r\n'), 'utf8');
  console.log(`Wrote: ${OUT_PATH}`);
  console.log(`Rows: ${rows.length}, Total sales: ${totSales.toLocaleString('ar-YE')} YER, Total collected: ${totCollected.toLocaleString('ar-YE')} YER`);

  await pool.close();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
