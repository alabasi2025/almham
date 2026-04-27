/**
 * Stage 05 — التسديدات (PaymentDataHistorical + PaymentData)
 *
 * ~255K سجل. streaming + bulk insert.
 */
import { ECAS_DATABASES, mssqlPool, pgClient, startTimer, progress, logImportRun } from './lib.mjs';

const BATCH_SIZE = 2000;

async function loadMaps(pg, ecasDb) {
  const periods = await pg`SELECT id, ecas_id FROM billing_periods WHERE ecas_db = ${ecasDb}`;
  const customers = await pg`SELECT id, ecas_id, station_id FROM billing_customers WHERE ecas_db = ${ecasDb}`;
  const cashiers = await pg`SELECT id, ecas_id FROM billing_cashiers WHERE ecas_db = ${ecasDb}`;

  const periodMap = new Map();
  for (const p of periods) periodMap.set(Number(p.ecas_id), p.id);
  const customerMap = new Map();
  for (const c of customers) customerMap.set(Number(c.ecas_id), c);
  const cashierMap = new Map();
  for (const c of cashiers) cashierMap.set(Number(c.ecas_id), c.id);
  return { periodMap, customerMap, cashierMap };
}

async function importPaymentsFor(pg, mssql, ecasDb, sourceTable) {
  const { periodMap, customerMap, cashierMap } = await loadMaps(pg, ecasDb);

  const totalResult = await mssql.request().query(`SELECT COUNT(*) AS N FROM ${sourceTable}`);
  const total = totalResult.recordset[0].N;
  if (total === 0) return { imported: 0, skipped: 0, failed: 0, read: 0, started: new Date() };
  console.log(`  📊 ${sourceTable}: ${total.toLocaleString()} سجل`);

  const request = mssql.request();
  request.stream = true;
  request.query(`
    SELECT Pay_AutoDebentureID, PG_ID, Cst_ID, Pay_Mony, Dt_ID, Cshr_ID, Pay_No,
           Pay_PaymentDate, Pay_InsertDate, Pay_Note, Pay_ManualDebentureID
    FROM ${sourceTable}
  `);

  let batch = [];
  let imported = 0, skipped = 0, failed = 0, read = 0;
  const started = new Date();

  async function flush() {
    if (batch.length === 0) return;
    try {
      await pg`
        INSERT INTO billing_payments ${pg(batch,
          'ecas_id', 'ecas_db', 'period_id', 'customer_id', 'station_id', 'cashier_id',
          'amount', 'source', 'receipt_no', 'paid_at', 'notes'
        )}
        ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET
          amount = EXCLUDED.amount,
          cashier_id = EXCLUDED.cashier_id,
          paid_at = EXCLUDED.paid_at,
          notes = EXCLUDED.notes
      `;
      imported += batch.length;
    } catch (e) {
      failed += batch.length;
      console.error(`\n  ⚠️  ${e.message.split('\n')[0]}`);
    }
    batch = [];
    progress('  تسديدات', imported + skipped + failed, total, failed ? `✗${failed}` : '');
  }

  return new Promise((resolve, reject) => {
    request.on('row', (row) => {
      read++;
      const customer = customerMap.get(Number(row.Cst_ID));
      const periodId = periodMap.get(Number(row.Dt_ID));
      if (!customer || !periodId) {
        skipped++;
        return;
      }
      const paidAt = row.Pay_PaymentDate ?? row.Pay_InsertDate ?? new Date();
      batch.push({
        ecas_id: Number(row.Pay_AutoDebentureID),
        ecas_db: ecasDb,
        period_id: periodId,
        customer_id: customer.id,
        station_id: customer.station_id,
        cashier_id: cashierMap.get(Number(row.Cshr_ID)) ?? null,
        amount: String(row.Pay_Mony ?? 0),
        source: 'import',
        receipt_no: row.Pay_No ? String(row.Pay_No) : null,
        paid_at: paidAt,
        notes: row.Pay_Note ?? null,
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
      console.log(`\n💰 ${ecasDb} — ${label}`);
      const mssql = await mssqlPool(ecasDb);
      try {
        // استيراد التسديدات التاريخية + الحالية
        for (const table of ['PaymentDataHistorical', 'PaymentData']) {
          const { imported, skipped, failed, read, started } = await importPaymentsFor(pg, mssql, ecasDb, table);
          if (imported || skipped || failed) {
            console.log(`\n  ✓ ${table}: ${imported.toLocaleString()}${skipped ? `, متجاوز: ${skipped}` : ''}${failed ? `, فاشل: ${failed}` : ''}`);
            grandTotal += imported;
            await logImportRun(pg, ecasDb, table, { read, inserted: imported, skipped, failed, startedAt: started });
          }
        }
      } finally {
        await mssql.close();
      }
    }
    console.log(`\n📊 المجموع: ${grandTotal.toLocaleString()} تسديد`);
    console.log(`✅ تمّ في ${t.elapsed()}`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
