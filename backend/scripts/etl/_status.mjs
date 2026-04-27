/**
 * أداة فحص — عرض حالة كل جداول نظام الفوترة في PostgreSQL مقارنةً بـ ECAS
 */
import { ECAS_DATABASES, mssqlPool, pgClient } from './lib.mjs';

const BILLING_TABLES = [
  { pg: 'billing_stations', ecas: null, label: 'محطات' },
  { pg: 'billing_areas', ecas: 'Area', label: 'مناطق' },
  { pg: 'billing_branches', ecas: 'Branch', label: 'فروع' },
  { pg: 'billing_registers', ecas: 'Segel', label: 'سجلات' },
  { pg: 'billing_squares', ecas: 'Squares', label: 'مربعات' },
  { pg: 'billing_activity_types', ecas: 'TypeSymbol', label: 'أنواع نشاط' },
  { pg: 'billing_address_types', ecas: 'AddressType', label: 'أنواع عنوان' },
  { pg: 'billing_tariff_slices', ecas: 'NewSliceDetail', label: 'شرائح تعرفة' },
  { pg: 'billing_periods', ecas: 'DateTable', label: 'فترات' },
  { pg: 'billing_cashiers', ecas: 'CashierData', label: 'محصّلون' },
  { pg: 'billing_customers', ecas: 'Customer', label: 'مشتركون' },
  { pg: 'billing_bills', ecas: 'BillAndRaedDataHistorical', label: 'فواتير (تاريخية)' },
  { pg: 'billing_payments', ecas: 'PaymentData', label: 'تسديدات (حية)' },
  { pg: 'billing_payments', ecas: 'PaymentDataHistorical', label: 'تسديدات (تاريخية)', noDoubleCount: true },
  { pg: 'billing_adjustments', ecas: 'TswBasicData', label: 'تسويات' },
];

async function pgCount(pg, table) {
  try {
    const r = await pg.unsafe(`SELECT COUNT(*)::int AS c FROM ${table}`);
    return r[0].c;
  } catch {
    return -1;
  }
}

async function mssqlCount(mssql, table) {
  try {
    const r = await mssql.request().query(`SELECT COUNT(*) AS c FROM ${table}`);
    return r.recordset[0].c;
  } catch {
    return -1;
  }
}

async function main() {
  const pg = pgClient();

  // Ecas totals
  const ecasTotals = {}; // tableName → { Ecas2673, Ecas2668, total }
  for (const { code } of ECAS_DATABASES) {
    const mssql = await mssqlPool(code);
    try {
      for (const { ecas } of BILLING_TABLES) {
        if (!ecas) continue;
        if (!ecasTotals[ecas]) ecasTotals[ecas] = { Ecas2673: 0, Ecas2668: 0, total: 0 };
        const n = await mssqlCount(mssql, ecas);
        if (n > 0) {
          ecasTotals[ecas][code] = n;
          ecasTotals[ecas].total += n;
        }
      }
    } finally {
      await mssql.close();
    }
  }

  // PG totals
  console.log('');
  console.log('┌──────────────────────────────┬──────────┬──────────┬──────────┬──────────────┐');
  console.log('│ الجدول                        │ PG       │ ECAS2673 │ ECAS2668 │ ECAS الإجمالي │');
  console.log('├──────────────────────────────┼──────────┼──────────┼──────────┼──────────────┤');
  for (const { pg: pgTable, ecas, label, noDoubleCount } of BILLING_TABLES) {
    const pgN = noDoubleCount ? '—' : await pgCount(pg, pgTable);
    const e73 = ecas ? (ecasTotals[ecas]?.Ecas2673 ?? 0) : 0;
    const e68 = ecas ? (ecasTotals[ecas]?.Ecas2668 ?? 0) : 0;
    const total = ecas ? (ecasTotals[ecas]?.total ?? 0) : 0;
    const diff = ecas && !noDoubleCount && pgN !== total ? ' ⚠️' : ' ✓';
    console.log(
      `│ ${label.padEnd(24)}     │ ${String(pgN).padStart(8)} │ ${String(e73).padStart(8)} │ ${String(e68).padStart(8)} │ ${String(total).padStart(10)}${diff} │`,
    );
  }
  console.log('└──────────────────────────────┴──────────┴──────────┴──────────┴──────────────┘');

  // Breakdown customers by station
  console.log('\n📊 تفصيل المشتركين حسب المحطة:');
  const byStation = await pg`
    SELECT bs.code, bs.name, MIN(bs.sort_order) AS so, COUNT(*)::int AS cnt
    FROM billing_customers bc
    JOIN billing_stations bs ON bs.id = bc.station_id
    GROUP BY bs.code, bs.name
    ORDER BY so
  `;
  for (const r of byStation) {
    console.log(`   ${r.name.padEnd(18)} ${String(r.cnt).padStart(6)} مشترك`);
  }

  // Breakdown bills by period (top 5 months)
  console.log('\n📅 آخر 5 فترات فوترة:');
  const lastPeriods = await pg`
    SELECT bp.name,
           COUNT(bb.id)::int AS bills,
           COALESCE(SUM(COALESCE(bb.consume_price, 0) + COALESCE(bb.consume_added_price, 0))::numeric, 0) AS total
    FROM billing_periods bp
    LEFT JOIN billing_bills bb ON bb.period_id = bp.id
    GROUP BY bp.id, bp.name, bp.from_date
    HAVING COUNT(bb.id) > 0
    ORDER BY bp.from_date DESC
    LIMIT 5
  `;
  for (const p of lastPeriods) {
    console.log(`   ${p.name.padEnd(18)} ${String(p.bills).padStart(7)} فاتورة، ${Number(p.total).toLocaleString('ar-YE')} ريال`);
  }

  // Breakdown payments by station
  console.log('\n💰 إجمالي التسديدات حسب المحطة:');
  const paysByStation = await pg`
    SELECT bs.name, MIN(bs.sort_order) AS so, COUNT(*)::int AS cnt, COALESCE(SUM(bp.amount)::numeric, 0) AS total
    FROM billing_payments bp
    JOIN billing_stations bs ON bs.id = bp.station_id
    GROUP BY bs.name
    ORDER BY so
  `;
  for (const r of paysByStation) {
    console.log(`   ${r.name.padEnd(18)} ${String(r.cnt).padStart(7)} تسديد، ${Number(r.total).toLocaleString('ar-YE')} ريال`);
  }

  // Import runs summary
  console.log('\n📦 سجل عمليات الاستيراد:');
  const runs = await pg`
    SELECT ecas_db, table_name, rows_inserted, rows_failed, duration_ms, started_at
    FROM billing_import_runs
    ORDER BY started_at DESC
    LIMIT 10
  `;
  for (const r of runs) {
    const dur = r.duration_ms > 60000 ? `${(r.duration_ms / 60000).toFixed(1)}m` : `${(r.duration_ms / 1000).toFixed(1)}s`;
    const err = r.rows_failed > 0 ? ` ❌${r.rows_failed}` : '';
    console.log(`   ${r.ecas_db} · ${r.table_name.padEnd(25)} ${String(r.rows_inserted).padStart(7)}${err}  [${dur}]`);
  }

  await pg.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
