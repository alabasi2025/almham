/**
 * Stage 06 — التسويات (TswBasicData)
 */
import { ECAS_DATABASES, mssqlPool, pgClient, startTimer, progress, logImportRun } from './lib.mjs';

const BATCH_SIZE = 1000;

async function loadMaps(pg, ecasDb) {
  const periods = await pg`SELECT id, ecas_id FROM billing_periods WHERE ecas_db = ${ecasDb}`;
  const customers = await pg`SELECT id, ecas_id, station_id FROM billing_customers WHERE ecas_db = ${ecasDb}`;
  const periodMap = new Map(periods.map((p) => [Number(p.ecas_id), p.id]));
  const customerMap = new Map(customers.map((c) => [Number(c.ecas_id), c]));
  return { periodMap, customerMap };
}

async function importAdjustments(pg, mssql, ecasDb) {
  const { periodMap, customerMap } = await loadMaps(pg, ecasDb);

  const total = (await mssql.request().query('SELECT COUNT(*) AS N FROM TswBasicData')).recordset[0].N;
  if (total === 0) return { imported: 0, skipped: 0, failed: 0, read: 0, started: new Date() };
  console.log(`  📊 ${total.toLocaleString()} تسوية`);

  const r = await mssql.request().query(`
    SELECT Dt_ID, Cst_ID, TwBd_TaswihValue, TwBd_TotalTaswihValue,
           TwBd_ConsumeOfficialPrice, TwBd_ConsumeExemptPrice,
           TwBd_InsertDate, TwBd_UpDateDate
    FROM TswBasicData
  `);

  let batch = [];
  let imported = 0, skipped = 0, failed = 0, read = 0;
  const started = new Date();

  async function flush() {
    if (!batch.length) return;
    try {
      await pg`
        INSERT INTO billing_adjustments ${pg(batch,
          'ecas_db', 'period_id', 'customer_id', 'station_id', 'type',
          'adjustment_value', 'total_value', 'official_price', 'exempt_price',
          'applied_at', 'updated_at'
        )}
      `;
      imported += batch.length;
    } catch (e) {
      failed += batch.length;
      console.error(`\n  ⚠️  ${e.message.split('\n')[0]}`);
    }
    batch = [];
    progress('  تسويات', imported + skipped + failed, total);
  }

  for (const row of r.recordset) {
    read++;
    const customer = customerMap.get(Number(row.Cst_ID));
    const periodId = periodMap.get(Number(row.Dt_ID));
    if (!customer || !periodId) { skipped++; continue; }

    batch.push({
      ecas_db: ecasDb,
      period_id: periodId,
      customer_id: customer.id,
      station_id: customer.station_id,
      type: 'data_correction', // افتراضي — TswBasicData لا تحدّد النوع
      adjustment_value: String(row.TwBd_TaswihValue ?? 0),
      total_value: String(row.TwBd_TotalTaswihValue ?? 0),
      official_price: String(row.TwBd_ConsumeOfficialPrice ?? 0),
      exempt_price: String(row.TwBd_ConsumeExemptPrice ?? 0),
      applied_at: row.TwBd_InsertDate ?? null,
      updated_at: row.TwBd_UpDateDate ?? null,
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return { imported, skipped, failed, read, started };
}

async function computeSummaries(pg) {
  console.log('\n📈 حساب ملخّصات الفترات...');
  // امسح الملخّصات السابقة ثم احسب من جديد
  await pg`TRUNCATE TABLE billing_period_summary`;
  await pg`
    INSERT INTO billing_period_summary (
      period_id, station_id, bills_count, total_kwh, total_sales,
      payments_count, total_collected, total_adjustments, total_arrears
    )
    SELECT
      b.period_id,
      b.station_id,
      COUNT(DISTINCT b.id)::int AS bills_count,
      COALESCE(SUM(b.month_consume), 0)::bigint AS total_kwh,
      COALESCE(SUM(b.consume_price + b.consume_added_price), 0) AS total_sales,
      COALESCE((SELECT COUNT(*) FROM billing_payments p WHERE p.period_id = b.period_id AND p.station_id = b.station_id), 0)::int,
      COALESCE((SELECT SUM(p.amount) FROM billing_payments p WHERE p.period_id = b.period_id AND p.station_id = b.station_id), 0),
      COALESCE((SELECT SUM(a.adjustment_value) FROM billing_adjustments a WHERE a.period_id = b.period_id AND a.station_id = b.station_id), 0),
      COALESCE(SUM(b.arrears), 0)
    FROM billing_bills b
    GROUP BY b.period_id, b.station_id
  `;
  const [{ n }] = await pg`SELECT COUNT(*)::int AS n FROM billing_period_summary`;
  console.log(`  ✓ ${n} ملخّص فترة × محطة`);
}

async function main() {
  const t = startTimer();
  const pg = pgClient();
  try {
    let grandTotal = 0;
    for (const { code: ecasDb, label } of ECAS_DATABASES) {
      console.log(`\n🛠️  ${ecasDb} — ${label}`);
      const mssql = await mssqlPool(ecasDb);
      try {
        const { imported, skipped, failed, read, started } = await importAdjustments(pg, mssql, ecasDb);
        console.log(`\n  ✓ مستورد: ${imported.toLocaleString()}${skipped ? `, متجاوز: ${skipped}` : ''}`);
        grandTotal += imported;
        await logImportRun(pg, ecasDb, 'adjustments', { read, inserted: imported, skipped, failed, startedAt: started });
      } finally {
        await mssql.close();
      }
    }
    console.log(`\n📊 المجموع: ${grandTotal.toLocaleString()} تسوية`);

    await computeSummaries(pg);
    console.log(`\n✅ تمّ في ${t.elapsed()}`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
