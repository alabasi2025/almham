/**
 * Stage 03 — المشتركون (Customer)
 *
 * نستورد كل المشتركين من Ecas2673 و Ecas2668.
 * محطة المشترك في Ecas2668 تُحدَّد من محطة مربعه.
 */
import { ECAS_DATABASES, mssqlPool, pgClient, startTimer, progress, logImportRun } from './lib.mjs';

const CHUNK = 200;

async function importCustomersFor(pg, mssql, ecasDb, defaultStation) {
  const r = await mssql.request().query(`
    SELECT
      c.Cst_ID, c.Cst_RefID, c.Cst_Name, c.Cst_Address, c.Cst_Negabor,
      c.Cst_CountNo, c.Cst_AdNo, c.Cst_AdFild, c.Cst_AdTor, c.Cst_TeleNo,
      c.Cst_BeginServceDate, c.Cst_LastRead, c.Cst_LastArrears, c.Cst_LastBalance,
      c.Squr_ID, c.Sgl_ID, c.Tsm_ID, c.AdTp_ID, c.FT_ID
    FROM Customer c
    ORDER BY c.Cst_ID
  `);
  const rows = r.recordset;
  const total = rows.length;
  let n = 0, failed = 0;
  const started = new Date();

  for (const row of rows) {
    try {
      await pg`
        INSERT INTO billing_customers (
          ecas_id, ecas_db, ecas_ref_id, station_id, square_id, register_id,
          activity_type_id, address_type_id, phase_id,
          subscriber_code, name, address, neighbor, count_no, ad_no, ad_field, ad_tor, phone,
          begin_service_date, last_read, last_arrears, last_balance, current_balance, state
        )
        SELECT
          ${row.Cst_ID}, ${ecasDb}, ${row.Cst_RefID},
          COALESCE(sq.station_id, def.id),
          sq.id, reg.id, act.id, adt.id, ph.id,
          ${String(row.Cst_AdNo ?? row.Cst_ID)},
          ${row.Cst_Name ?? ''},
          ${row.Cst_Address ?? null},
          ${row.Cst_Negabor ?? null},
          ${row.Cst_CountNo ?? null},
          ${row.Cst_AdNo ?? null},
          ${row.Cst_AdFild ?? null},
          ${row.Cst_AdTor ?? null},
          ${row.Cst_TeleNo ?? null},
          ${row.Cst_BeginServceDate ?? null},
          ${row.Cst_LastRead !== null && row.Cst_LastRead !== undefined ? String(row.Cst_LastRead) : null},
          ${row.Cst_LastArrears !== null && row.Cst_LastArrears !== undefined ? String(row.Cst_LastArrears) : '0'},
          ${row.Cst_LastBalance !== null && row.Cst_LastBalance !== undefined ? String(row.Cst_LastBalance) : '0'},
          ${row.Cst_LastBalance !== null && row.Cst_LastBalance !== undefined ? String(row.Cst_LastBalance) : '0'},
          'active'
        FROM billing_stations def
        LEFT JOIN billing_squares sq ON sq.ecas_db = ${ecasDb} AND sq.ecas_id = ${row.Squr_ID}
        LEFT JOIN billing_registers reg ON reg.ecas_db = ${ecasDb} AND reg.ecas_id = ${row.Sgl_ID}
        LEFT JOIN billing_activity_types act ON act.ecas_db = ${ecasDb} AND act.ecas_id = ${row.Tsm_ID}
        LEFT JOIN billing_address_types adt ON adt.ecas_db = ${ecasDb} AND adt.ecas_id = ${row.AdTp_ID}
        LEFT JOIN billing_phases ph ON ph.ecas_db = ${ecasDb} AND ph.ecas_id = ${row.FT_ID}
        WHERE def.code = ${defaultStation}
        ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          neighbor = EXCLUDED.neighbor,
          count_no = EXCLUDED.count_no,
          ad_no = EXCLUDED.ad_no,
          ad_field = EXCLUDED.ad_field,
          ad_tor = EXCLUDED.ad_tor,
          phone = EXCLUDED.phone,
          begin_service_date = EXCLUDED.begin_service_date,
          last_read = EXCLUDED.last_read,
          last_arrears = EXCLUDED.last_arrears,
          last_balance = EXCLUDED.last_balance,
          current_balance = EXCLUDED.current_balance,
          station_id = EXCLUDED.station_id,
          square_id = EXCLUDED.square_id,
          register_id = EXCLUDED.register_id,
          activity_type_id = EXCLUDED.activity_type_id,
          updated_at = now()
      `;
      n++;
    } catch (e) {
      failed++;
      if (failed <= 3) console.warn(`\n  ⚠️  Cst_ID=${row.Cst_ID}: ${e.message.split('\n')[0]}`);
    }
    if (n % 50 === 0 || n === total) progress('  مشتركون', n + failed, total, failed ? `✗ ${failed}` : '');
  }
  progress('  مشتركون', total, total, failed ? `✗ ${failed}` : '');
  return { n, failed, started };
}

async function main() {
  const t = startTimer();
  const pg = pgClient();
  try {
    for (const { code: ecasDb, station: defaultStation, label } of ECAS_DATABASES) {
      console.log(`\n👥 ${ecasDb} — ${label}`);
      const mssql = await mssqlPool(ecasDb);
      try {
        const { n, failed, started } = await importCustomersFor(pg, mssql, ecasDb, defaultStation);
        console.log(`  ✓ مستوردون: ${n}${failed ? ` (فشل ${failed})` : ''}`);
        await logImportRun(pg, ecasDb, 'customers', { read: n + failed, inserted: n, failed, startedAt: started });
      } finally {
        await mssql.close();
      }
    }

    // ملخص
    const [{ total, byStation }] = await pg`
      SELECT COUNT(*)::int AS total,
        json_agg(json_build_object('station', name, 'count', cnt) ORDER BY cnt DESC) AS by_station
      FROM (
        SELECT s.name, COUNT(*)::int AS cnt
        FROM billing_customers c JOIN billing_stations s ON s.id = c.station_id
        GROUP BY s.name
      ) x
    `.then((rows) => rows.map((r) => ({ total: r.total, byStation: r.by_station })));

    console.log(`\n📊 المجموع: ${total} مشترك`);
    for (const s of byStation) console.log(`   ${s.station}: ${s.count}`);

    console.log(`\n✅ تمّ في ${t.elapsed()}`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
