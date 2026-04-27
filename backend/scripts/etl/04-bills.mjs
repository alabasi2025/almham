/**
 * Stage 04 — الفواتير (BillAndRaedDataHistorical)
 *
 * ~493K سجل. نستخدم bulk insert بدفعات 2000.
 * نحمّل خرائط FK مرة واحدة في الذاكرة ثم نستورد.
 */
import { ECAS_DATABASES, mssqlPool, pgClient, startTimer, progress, chunk, logImportRun } from './lib.mjs';

const BATCH_SIZE = 2000;

async function loadLookupMaps(pg, ecasDb) {
  const periods = await pg`SELECT id, ecas_id FROM billing_periods WHERE ecas_db = ${ecasDb}`;
  const customers = await pg`SELECT id, ecas_id, station_id, square_id FROM billing_customers WHERE ecas_db = ${ecasDb}`;

  const periodMap = new Map();
  for (const p of periods) periodMap.set(Number(p.ecas_id), p.id);

  const customerMap = new Map();
  for (const c of customers) customerMap.set(Number(c.ecas_id), c);

  return { periodMap, customerMap };
}

async function importBillsFor(pg, mssql, ecasDb) {
  const { periodMap, customerMap } = await loadLookupMaps(pg, ecasDb);
  console.log(`  📌 فترات: ${periodMap.size}, مشتركون: ${customerMap.size}`);

  // عدد الصفوف
  const totalResult = await mssql.request().query('SELECT COUNT(*) AS N FROM BillAndRaedDataHistorical');
  const total = totalResult.recordset[0].N;
  console.log(`  📊 قراءة ${total.toLocaleString()} فاتورة...`);

  // قراءة بالتدفّق (streaming) لتجنّب استهلاك الذاكرة
  const request = mssql.request();
  request.stream = true;
  request.query(`
    SELECT
      b.Dt_ID, b.Cst_ID, b.Cst_MonthConsume, b.Cst_LastRead, b.Cst_CurrentRead,
      b.Cst_ConsumeValue, b.Cst_DailyConstConsumeValue,
      b.Cst_ConsumePrice, b.Cst_ConsumeAddedPrice, b.Cst_ConsumeOfficialPrice, b.Cst_ConsumeExemptPrice,
      b.Cst_LastBalance, b.Cst_LastArrears, b.Cst_Arrears,
      b.Cst_PaymentCount, b.Cst_PaymentSumMoney, b.Cst_CountZeroRead, b.Cst_CountZeroPayment
    FROM BillAndRaedDataHistorical b
  `);

  let batch = [];
  let imported = 0, skipped = 0, failed = 0, read = 0;
  const started = new Date();

  async function flush() {
    if (batch.length === 0) return;
    try {
      await pg`
        INSERT INTO billing_bills ${pg(batch,
          'ecas_db', 'ecas_dt_id', 'period_id', 'customer_id', 'station_id', 'square_id',
          'previous_read', 'current_read', 'month_consume', 'consume_value', 'daily_const_consume',
          'consume_price', 'consume_added_price', 'consume_official_price', 'consume_exempt_price',
          'last_balance', 'last_arrears', 'arrears',
          'payment_count', 'payment_sum_money', 'count_zero_read', 'count_zero_payment',
          'reading_source'
        )}
        ON CONFLICT (ecas_db, ecas_dt_id, customer_id) DO UPDATE SET
          previous_read = EXCLUDED.previous_read,
          current_read = EXCLUDED.current_read,
          month_consume = EXCLUDED.month_consume,
          consume_price = EXCLUDED.consume_price,
          consume_added_price = EXCLUDED.consume_added_price,
          consume_official_price = EXCLUDED.consume_official_price,
          last_balance = EXCLUDED.last_balance,
          last_arrears = EXCLUDED.last_arrears,
          arrears = EXCLUDED.arrears,
          payment_count = EXCLUDED.payment_count,
          payment_sum_money = EXCLUDED.payment_sum_money
      `;
      imported += batch.length;
    } catch (e) {
      failed += batch.length;
      console.error(`\n  ⚠️  دفعة (${batch.length}) فشلت: ${e.message.split('\n')[0]}`);
    }
    batch = [];
    progress('  فواتير', imported + skipped + failed, total, failed ? `✗${failed}` : '');
  }

  return new Promise((resolve, reject) => {
    request.on('row', (row) => {
      read++;
      const periodId = periodMap.get(Number(row.Dt_ID));
      const customer = customerMap.get(Number(row.Cst_ID));
      if (!periodId || !customer) {
        skipped++;
        return;
      }

      batch.push({
        ecas_db: ecasDb,
        ecas_dt_id: Number(row.Dt_ID),
        period_id: periodId,
        customer_id: customer.id,
        station_id: customer.station_id,
        square_id: customer.square_id,
        previous_read: row.Cst_LastRead != null ? String(row.Cst_LastRead) : null,
        current_read: row.Cst_CurrentRead != null ? String(row.Cst_CurrentRead) : null,
        month_consume: Number(row.Cst_MonthConsume ?? 0),
        consume_value: row.Cst_ConsumeValue != null ? String(row.Cst_ConsumeValue) : null,
        daily_const_consume: row.Cst_DailyConstConsumeValue != null ? String(row.Cst_DailyConstConsumeValue) : null,
        consume_price: String(row.Cst_ConsumePrice ?? 0),
        consume_added_price: String(row.Cst_ConsumeAddedPrice ?? 0),
        consume_official_price: String(row.Cst_ConsumeOfficialPrice ?? 0),
        consume_exempt_price: String(row.Cst_ConsumeExemptPrice ?? 0),
        last_balance: String(row.Cst_LastBalance ?? 0),
        last_arrears: String(row.Cst_LastArrears ?? 0),
        arrears: String(row.Cst_Arrears ?? 0),
        payment_count: Number(row.Cst_PaymentCount ?? 0),
        payment_sum_money: String(row.Cst_PaymentSumMoney ?? 0),
        count_zero_read: Number(row.Cst_CountZeroRead ?? 0),
        count_zero_payment: Number(row.Cst_CountZeroPayment ?? 0),
        reading_source: 'import',
      });

      if (batch.length >= BATCH_SIZE) {
        request.pause();
        flush().then(() => request.resume()).catch(reject);
      }
    });

    request.on('error', reject);
    request.on('done', async () => {
      try {
        await flush();
        resolve({ imported, skipped, failed, read, started });
      } catch (e) { reject(e); }
    });
  });
}

async function main() {
  const t = startTimer();
  const pg = pgClient();
  try {
    let grandTotal = 0;
    for (const { code: ecasDb, label } of ECAS_DATABASES) {
      console.log(`\n🧾 ${ecasDb} — ${label}`);
      const mssql = await mssqlPool(ecasDb);
      try {
        const { imported, skipped, failed, read, started } = await importBillsFor(pg, mssql, ecasDb);
        console.log(`\n  ✓ مستوردة: ${imported.toLocaleString()}${skipped ? `, متجاوزة: ${skipped}` : ''}${failed ? `, فاشلة: ${failed}` : ''}`);
        grandTotal += imported;
        await logImportRun(pg, ecasDb, 'bills', { read, inserted: imported, skipped, failed, startedAt: started });
      } finally {
        await mssql.close();
      }
    }

    console.log(`\n📊 المجموع: ${grandTotal.toLocaleString()} فاتورة`);
    console.log(`✅ تمّ في ${t.elapsed()}`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
