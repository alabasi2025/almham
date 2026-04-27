#!/usr/bin/env node
/**
 * Export Dahamiya sales/collections to a self-contained HTML report.
 * Opens in any browser — no Excel needed.
 * Output: d:\almham\exports\dahamiya-sales-per-period.html
 */
import sql from 'mssql';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', '..', 'exports', 'dahamiya-sales-per-period.html');

const config = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  database: 'Ecas2673',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15_000,
  requestTimeout: 60_000,
};

const QUERY = `
SELECT
  dt.Dt_ID AS periodId, dt.Yr_ID AS year, dt.Mon_ID AS month,
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
LEFT JOIN (SELECT Dt_ID, COUNT(*) AS Bills,
  CAST(SUM(Cst_MonthConsume) AS INT) AS Kwh,
  CAST(SUM(Cst_ConsumePrice + ISNULL(Cst_ConsumeAddedPrice,0)) AS DECIMAL(20,0)) AS Sales
  FROM BillAndRaedDataHistorical GROUP BY Dt_ID) b ON b.Dt_ID = dt.Dt_ID
LEFT JOIN (SELECT Dt_ID, COUNT(*) AS PayCount,
  CAST(SUM(Pay_Mony) AS DECIMAL(20,0)) AS Collected
  FROM PaymentDataHistorical GROUP BY Dt_ID) p ON p.Dt_ID = dt.Dt_ID
LEFT JOIN (SELECT Dt_ID, CAST(SUM(TwBd_TaswihValue) AS DECIMAL(20,0)) AS Taswih
  FROM TswBasicData GROUP BY Dt_ID) t ON t.Dt_ID = dt.Dt_ID
ORDER BY dt.Dt_ID DESC
`;

const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');

function render(rows) {
  let totSales = 0, totCollected = 0, totAdj = 0, totKwh = 0, totBills = 0, totPays = 0;
  const active = rows.filter((r) => Number(r.bills) + Number(r.sales) + Number(r.collected) + Number(r.adjustments) > 0);
  for (const r of active) {
    totSales += Number(r.sales);
    totCollected += Number(r.collected);
    totAdj += Number(r.adjustments);
    totKwh += Number(r.kwh);
    totBills += Number(r.bills);
    totPays += Number(r.payCount);
  }
  const rate = totSales > 0 ? (totCollected / totSales * 100).toFixed(1) : '0';

  const yearMap = new Map();
  for (const r of active) {
    const y = Number(r.year);
    const cur = yearMap.get(y) ?? { year: y, bills: 0, kwh: 0, sales: 0, payCount: 0, collected: 0, adjustments: 0 };
    cur.bills += Number(r.bills);
    cur.kwh += Number(r.kwh);
    cur.sales += Number(r.sales);
    cur.payCount += Number(r.payCount);
    cur.collected += Number(r.collected);
    cur.adjustments += Number(r.adjustments);
    yearMap.set(y, cur);
  }
  const years = [...yearMap.values()].sort((a, b) => b.year - a.year);

  const periodRows = active.map((r) => {
    const sales = Number(r.sales);
    const collected = Number(r.collected);
    const diff = sales - collected;
    const diffCls = diff < 0 ? 'neg' : diff > 0 ? 'pos' : '';
    return `<tr data-year="${r.year}">
      <td class="mono">${r.periodId}</td>
      <td>${r.periodName}</td>
      <td>${r.fromDate ?? ''}</td>
      <td>${r.toDate ?? ''}</td>
      <td class="num">${fmt(r.bills)}</td>
      <td class="num">${fmt(r.kwh)}</td>
      <td class="num money">${fmt(sales)}</td>
      <td class="num">${fmt(r.payCount)}</td>
      <td class="num money">${fmt(collected)}</td>
      <td class="num">${fmt(r.adjustments)}</td>
      <td class="num ${diffCls}">${fmt(diff)}</td>
    </tr>`;
  }).join('\n');

  const yearRows = years.map((y) => {
    const rate = y.sales > 0 ? (y.collected / y.sales * 100).toFixed(1) : '0';
    return `<tr>
      <td class="mono bold">${y.year}</td>
      <td class="num">${fmt(y.bills)}</td>
      <td class="num">${fmt(y.kwh)}</td>
      <td class="num money">${fmt(y.sales)}</td>
      <td class="num">${fmt(y.payCount)}</td>
      <td class="num money">${fmt(y.collected)}</td>
      <td class="num">${fmt(y.adjustments)}</td>
      <td class="num"><strong>${rate}%</strong></td>
    </tr>`;
  }).join('\n');

  const yearOpts = years.map((y) => `<option value="${y.year}">${y.year}</option>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير المبيعات والتحصيل - الدهمية</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Tahoma', sans-serif; background: #f3f4f6; color: #111827; padding: 24px; }
  h1 { color: #0e7490; margin-bottom: 6px; font-size: 28px; }
  .subtitle { color: #6b7280; margin-bottom: 24px; font-size: 14px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .kpi { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-right: 4px solid #0e7490; }
  .kpi .label { color: #6b7280; font-size: 13px; margin-bottom: 8px; }
  .kpi .value { font-size: 24px; font-weight: 700; color: #0e7490; }
  .kpi.success { border-right-color: #059669; }
  .kpi.success .value { color: #059669; }
  section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h2 { color: #1f2937; margin-bottom: 16px; font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
  .controls { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .controls label { font-size: 14px; color: #374151; }
  .controls select, .controls input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; font-family: inherit; }
  .controls button { padding: 8px 16px; background: #0e7490; color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-family: inherit; }
  .controls button:hover { background: #155e75; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead { background: #0e7490; color: #fff; position: sticky; top: 0; }
  th { padding: 12px 8px; text-align: center; font-weight: 600; white-space: nowrap; }
  td { padding: 10px 8px; border-bottom: 1px solid #f3f4f6; text-align: center; }
  tbody tr:hover { background: #f9fafb; }
  .num { font-variant-numeric: tabular-nums; text-align: end; padding-left: 16px; }
  .mono { font-family: 'Consolas', monospace; }
  .money { color: #0e7490; font-weight: 600; }
  .pos { color: #059669; font-weight: 600; }
  .neg { color: #dc2626; font-weight: 600; }
  .bold { font-weight: 700; }
  tfoot { background: #fef3c7; font-weight: 700; }
  tfoot td { padding: 14px 8px; border-top: 2px solid #f59e0b; }
  .scroll { max-height: 600px; overflow-y: auto; }
  .note { background: #fef3c7; border-right: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; color: #78350f; }
</style>
</head>
<body>
  <h1>💡 تقرير المبيعات والتحصيل — محطة الدهمية</h1>
  <div class="subtitle">Ecas2673 · آخر تحديث: ${new Date().toLocaleString('ar-YE-u-nu-latn')}</div>

  <div class="kpi-grid">
    <div class="kpi"><div class="label">إجمالي المبيعات (9 سنوات)</div><div class="value">${fmt(totSales)}</div></div>
    <div class="kpi success"><div class="label">إجمالي التحصيل</div><div class="value">${fmt(totCollected)}</div></div>
    <div class="kpi"><div class="label">نسبة التحصيل</div><div class="value">${rate}%</div></div>
    <div class="kpi"><div class="label">إجمالي الاستهلاك kWh</div><div class="value">${fmt(totKwh)}</div></div>
    <div class="kpi"><div class="label">عدد الفواتير</div><div class="value">${fmt(totBills)}</div></div>
    <div class="kpi"><div class="label">عدد التسديدات</div><div class="value">${fmt(totPays)}</div></div>
  </div>

  <section>
    <h2>📊 الملخّص السنوي</h2>
    <table>
      <thead><tr>
        <th>السنة</th><th>الفواتير</th><th>kWh</th><th>المبيعات</th>
        <th>التسديدات</th><th>التحصيل</th><th>التسويات</th><th>نسبة التحصيل</th>
      </tr></thead>
      <tbody>${yearRows}</tbody>
    </table>
  </section>

  <section>
    <h2>📅 تفصيل كل فترة فوترية (${active.length} فترة)</h2>
    <div class="controls">
      <label>السنة:
        <select id="yearFilter">
          <option value="">كل السنوات</option>${yearOpts}
        </select>
      </label>
      <button onclick="downloadCsv()">📥 تنزيل CSV</button>
    </div>
    <div class="scroll">
      <table id="periodsTable">
        <thead><tr>
          <th>رقم الفترة</th><th>اسم الفترة</th><th>من</th><th>إلى</th>
          <th>الفواتير</th><th>kWh</th><th>المبيعات</th>
          <th>التسديدات</th><th>التحصيل</th><th>التسويات</th><th>الفرق</th>
        </tr></thead>
        <tbody>${periodRows}</tbody>
        <tfoot><tr>
          <td colspan="4">الإجمالي</td>
          <td class="num">${fmt(totBills)}</td>
          <td class="num">${fmt(totKwh)}</td>
          <td class="num money">${fmt(totSales)}</td>
          <td class="num">${fmt(totPays)}</td>
          <td class="num money">${fmt(totCollected)}</td>
          <td class="num">${fmt(totAdj)}</td>
          <td class="num ${totSales - totCollected < 0 ? 'neg' : 'pos'}">${fmt(totSales - totCollected)}</td>
        </tr></tfoot>
      </table>
    </div>
  </section>

  <script>
    const yearSel = document.getElementById('yearFilter');
    yearSel.addEventListener('change', () => {
      const v = yearSel.value;
      document.querySelectorAll('#periodsTable tbody tr').forEach((tr) => {
        tr.style.display = !v || tr.dataset.year === v ? '' : 'none';
      });
    });
    function downloadCsv() {
      const rows = [...document.querySelectorAll('#periodsTable tr')].filter(r => r.style.display !== 'none');
      const csv = '\\uFEFF' + rows.map(r => [...r.children].map(c => '"' + c.textContent.trim().replace(/"/g,'""') + '"').join(',')).join('\\r\\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'dahamiya-sales.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;
}

async function main() {
  console.log('Connecting to localhost\\ECASDEV → Ecas2673 ...');
  const pool = await sql.connect(config);
  const result = await pool.request().query(QUERY);
  const rows = result.recordset;
  console.log(`Fetched ${rows.length} periods.`);
  const html = render(rows);
  writeFileSync(OUT_PATH, html, 'utf8');
  console.log(`Wrote: ${OUT_PATH}`);
  await pool.close();
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
