#!/usr/bin/env node
/**
 * Export Dahamiya sales/collections per billing period to a proper Excel (.xlsx) file.
 * Output: d:\almham\exports\dahamiya-sales-per-period.xlsx
 */
import sql from 'mssql';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', '..', 'exports', 'dahamiya-sales-per-period.xlsx');

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

const QUERY = `
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
ORDER BY dt.Dt_ID DESC
`;

async function main() {
  console.log('Connecting to localhost\\ECASDEV → Ecas2673 ...');
  const pool = await sql.connect(config);
  const result = await pool.request().query(QUERY);
  const rows = result.recordset;
  console.log(`Fetched ${rows.length} periods.`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'أنظمة العباسي المتخصصة';
  wb.created = new Date();
  wb.views = [{ rightToLeft: true }]; // Arabic RTL view

  // ============= Sheet 1: Periods =============
  const ws = wb.addWorksheet('الفترات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  ws.columns = [
    { header: 'رقم الفترة', key: 'periodId', width: 14 },
    { header: 'السنة', key: 'year', width: 8 },
    { header: 'الشهر', key: 'month', width: 8 },
    { header: 'اسم الفترة', key: 'periodName', width: 28 },
    { header: 'من تاريخ', key: 'fromDate', width: 13 },
    { header: 'إلى تاريخ', key: 'toDate', width: 13 },
    { header: 'عدد الفواتير', key: 'bills', width: 12 },
    { header: 'الاستهلاك kWh', key: 'kwh', width: 14 },
    { header: 'إجمالي المبيعات', key: 'sales', width: 18 },
    { header: 'عدد التسديدات', key: 'payCount', width: 14 },
    { header: 'إجمالي التحصيل', key: 'collected', width: 18 },
    { header: 'التسويات', key: 'adjustments', width: 14 },
    { header: 'الفرق (مبيعات − تحصيل)', key: 'diff', width: 20 },
  ];

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  headerRow.height = 30;

  let totSales = 0, totCollected = 0, totAdj = 0, totKwh = 0, totBills = 0, totPays = 0;
  for (const r of rows) {
    const sales = Number(r.sales ?? 0);
    const collected = Number(r.collected ?? 0);
    const adj = Number(r.adjustments ?? 0);
    const bills = Number(r.bills ?? 0);
    const kwh = Number(r.kwh ?? 0);
    const payCount = Number(r.payCount ?? 0);
    totSales += sales;
    totCollected += collected;
    totAdj += adj;
    totKwh += kwh;
    totBills += bills;
    totPays += payCount;

    // Skip empty rows for cleanliness
    if (bills === 0 && sales === 0 && collected === 0 && adj === 0) continue;

    ws.addRow({
      periodId: r.periodId,
      year: r.year,
      month: r.month,
      periodName: r.periodName,
      fromDate: r.fromDate,
      toDate: r.toDate,
      bills,
      kwh,
      sales,
      payCount,
      collected,
      adjustments: adj,
      diff: sales - collected,
    });
  }

  // Totals row
  const totalRow = ws.addRow({
    periodId: '',
    year: '',
    month: '',
    periodName: 'الإجمالي',
    fromDate: '',
    toDate: '',
    bills: totBills,
    kwh: totKwh,
    sales: totSales,
    payCount: totPays,
    collected: totCollected,
    adjustments: totAdj,
    diff: totSales - totCollected,
  });
  totalRow.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  totalRow.height = 28;

  // Number formatting
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    row.getCell('bills').numFmt = '#,##0';
    row.getCell('kwh').numFmt = '#,##0';
    row.getCell('sales').numFmt = '#,##0';
    row.getCell('payCount').numFmt = '#,##0';
    row.getCell('collected').numFmt = '#,##0';
    row.getCell('adjustments').numFmt = '#,##0';
    row.getCell('diff').numFmt = '#,##0;[Red]-#,##0';
    row.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  }

  // Borders
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  // AutoFilter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 13 },
  };

  // ============= Sheet 2: Yearly summary =============
  const yearSummary = new Map();
  for (const r of rows) {
    const y = Number(r.year);
    const cur = yearSummary.get(y) ?? { year: y, bills: 0, kwh: 0, sales: 0, payCount: 0, collected: 0, adjustments: 0 };
    cur.bills += Number(r.bills ?? 0);
    cur.kwh += Number(r.kwh ?? 0);
    cur.sales += Number(r.sales ?? 0);
    cur.payCount += Number(r.payCount ?? 0);
    cur.collected += Number(r.collected ?? 0);
    cur.adjustments += Number(r.adjustments ?? 0);
    yearSummary.set(y, cur);
  }

  const ws2 = wb.addWorksheet('ملخص سنوي', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  ws2.columns = [
    { header: 'السنة', key: 'year', width: 10 },
    { header: 'عدد الفواتير', key: 'bills', width: 14 },
    { header: 'الاستهلاك kWh', key: 'kwh', width: 15 },
    { header: 'إجمالي المبيعات', key: 'sales', width: 20 },
    { header: 'عدد التسديدات', key: 'payCount', width: 14 },
    { header: 'إجمالي التحصيل', key: 'collected', width: 20 },
    { header: 'التسويات', key: 'adjustments', width: 14 },
    { header: 'نسبة التحصيل %', key: 'rate', width: 15 },
  ];
  const header2 = ws2.getRow(1);
  header2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  header2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
  header2.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  header2.height = 28;

  const years = [...yearSummary.values()].sort((a, b) => a.year - b.year);
  for (const y of years) {
    const rate = y.sales > 0 ? (y.collected / y.sales) * 100 : 0;
    ws2.addRow({ ...y, rate: Math.round(rate * 10) / 10 });
  }
  for (let i = 2; i <= ws2.rowCount; i++) {
    const row = ws2.getRow(i);
    row.getCell('bills').numFmt = '#,##0';
    row.getCell('kwh').numFmt = '#,##0';
    row.getCell('sales').numFmt = '#,##0';
    row.getCell('payCount').numFmt = '#,##0';
    row.getCell('collected').numFmt = '#,##0';
    row.getCell('adjustments').numFmt = '#,##0';
    row.getCell('rate').numFmt = '0.0"%"';
    row.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  }

  await wb.xlsx.writeFile(OUT_PATH);
  console.log(`Wrote: ${OUT_PATH}`);
  console.log(`Total sales: ${totSales.toLocaleString('en-US')} YER | Total collected: ${totCollected.toLocaleString('en-US')} YER`);

  await pool.close();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
