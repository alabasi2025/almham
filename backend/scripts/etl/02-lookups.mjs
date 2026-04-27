/**
 * Stage 02 — المراجع والبيانات الأساسية
 *
 *  - Areas, Branches, Registers, Squares
 *  - ActivityTypes (TypeSymbol), AddressTypes, Phases
 *  - TariffSlices (NewSliceDetail)
 *  - Periods (DateTable)
 *  - Cashiers
 *
 *  يستورد من Ecas2673 و Ecas2668 مع فصل عبر (ecas_db + ecas_id).
 *  مربعات Ecas2668 تُصنَّف محطتها حسب اسم المربع (جمال / غليل / صبالية).
 */
import { ECAS_DATABASES, mssqlPool, pgClient, startTimer, progress, classifySabaliyaSquare, logImportRun } from './lib.mjs';

async function importAreas(pg, mssql, ecasDb, stationCodeByEcasDb) {
  const r = await mssql.request().query('SELECT Ar_ID, Ar_Name FROM Area ORDER BY Ar_ID');
  let n = 0;
  for (const row of r.recordset) {
    await pg`
      INSERT INTO billing_areas (station_id, ecas_id, ecas_db, name)
      SELECT id, ${row.Ar_ID}, ${ecasDb}, ${row.Ar_Name ?? ''}
      FROM billing_stations WHERE code = ${stationCodeByEcasDb}
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET name = EXCLUDED.name
    `;
    n++;
  }
  return n;
}

async function importBranches(pg, mssql, ecasDb, stationCodeByEcasDb) {
  const r = await mssql.request().query('SELECT Brn_ID, Brn_Name, Ar_ID FROM Branch ORDER BY Brn_ID');
  let n = 0;
  for (const row of r.recordset) {
    await pg`
      INSERT INTO billing_branches (station_id, ecas_id, ecas_db, name, area_id)
      SELECT s.id, ${row.Brn_ID}, ${ecasDb}, ${row.Brn_Name ?? ''}, a.id
      FROM billing_stations s
      LEFT JOIN billing_areas a ON a.ecas_db = ${ecasDb} AND a.ecas_id = ${row.Ar_ID}
      WHERE s.code = ${stationCodeByEcasDb}
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET name = EXCLUDED.name, area_id = EXCLUDED.area_id
    `;
    n++;
  }
  return n;
}

async function importRegisters(pg, mssql, ecasDb, stationCodeByEcasDb) {
  const r = await mssql.request().query('SELECT Sgl_ID, Sgl_Name FROM Segel ORDER BY Sgl_ID');
  let n = 0;
  for (const row of r.recordset) {
    await pg`
      INSERT INTO billing_registers (station_id, ecas_id, ecas_db, name)
      SELECT id, ${row.Sgl_ID}, ${ecasDb}, ${row.Sgl_Name ?? ''}
      FROM billing_stations WHERE code = ${stationCodeByEcasDb}
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET name = EXCLUDED.name
    `;
    n++;
  }
  return n;
}

async function importSquares(pg, mssql, ecasDb, defaultStationCode) {
  const r = await mssql.request().query('SELECT Squr_ID, Squr_Name FROM Squares ORDER BY Squr_ID');
  const rows = r.recordset;
  let n = 0;
  for (const row of rows) {
    const name = row.Squr_Name ?? '';
    let stationCode = defaultStationCode;
    let detected = null;
    let needsReview = false;

    if (ecasDb === 'Ecas2668') {
      const cls = classifySabaliyaSquare(name);
      stationCode = cls.station;
      detected = cls.station;
      needsReview = cls.needsReview;
    }

    await pg`
      INSERT INTO billing_squares (station_id, ecas_id, ecas_db, name, detected_station, needs_review)
      SELECT id, ${row.Squr_ID}, ${ecasDb}, ${name}, ${detected}, ${needsReview}
      FROM billing_stations WHERE code = ${stationCode}
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET
        name = EXCLUDED.name,
        detected_station = EXCLUDED.detected_station,
        needs_review = EXCLUDED.needs_review,
        station_id = EXCLUDED.station_id
    `;
    n++;
    if (n % 50 === 0) progress('  مربعات', n, rows.length);
  }
  progress('  مربعات', rows.length, rows.length);
  return n;
}

async function importActivityTypes(pg, mssql, ecasDb) {
  const r = await mssql.request().query('SELECT Tsm_ID, Tsm_Name FROM TypeSymbol ORDER BY Tsm_ID');
  let n = 0;
  for (const row of r.recordset) {
    await pg`
      INSERT INTO billing_activity_types (ecas_id, ecas_db, name)
      VALUES (${row.Tsm_ID}, ${ecasDb}, ${row.Tsm_Name ?? ''})
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET name = EXCLUDED.name
    `;
    n++;
  }
  return n;
}

async function importAddressTypes(pg, mssql, ecasDb) {
  try {
    const r = await mssql.request().query('SELECT AdTp_ID, AdTp_Name FROM AddressType ORDER BY AdTp_ID');
    let n = 0;
    for (const row of r.recordset) {
      await pg`
        INSERT INTO billing_address_types (ecas_id, ecas_db, name)
        VALUES (${row.AdTp_ID}, ${ecasDb}, ${row.AdTp_Name ?? ''})
        ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET name = EXCLUDED.name
      `;
      n++;
    }
    return n;
  } catch (e) {
    console.warn(`  ⚠️  AddressType: ${e.message.split('\n')[0]}`);
    return 0;
  }
}

async function importTariffSlices(pg, mssql, ecasDb) {
  try {
    const r = await mssql.request().query(`
      SELECT NSD_ID, Tsm_ID, NSD_SliceValue AS FromKwh, NSD_SlicePrice AS Price
      FROM NewSliceDetail ORDER BY NSD_ID
    `);
    let n = 0;
    for (const row of r.recordset) {
      await pg`
        INSERT INTO billing_tariff_slices (ecas_id, ecas_db, activity_type_id, from_kwh, price_per_kwh)
        SELECT ${row.NSD_ID}, ${ecasDb}, at.id, ${row.FromKwh ?? 0}, ${String(row.Price ?? 0)}
        FROM (SELECT NULL::uuid AS id) AS _
        LEFT JOIN billing_activity_types at ON at.ecas_db = ${ecasDb} AND at.ecas_id = ${row.Tsm_ID}
        ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET
          activity_type_id = EXCLUDED.activity_type_id,
          from_kwh = EXCLUDED.from_kwh,
          price_per_kwh = EXCLUDED.price_per_kwh
      `;
      n++;
    }
    return n;
  } catch (e) {
    console.warn(`  ⚠️  TariffSlices: ${e.message.split('\n')[0]}`);
    return 0;
  }
}

async function importPeriods(pg, mssql, ecasDb) {
  const r = await mssql.request().query(`
    SELECT Dt_ID, Yr_ID, Mon_ID, Dt_Name, Dt_FromDate, Dt_ToDate,
           Dt_IsComputed, Dt_IsLocked, Dt_IsAllowPayForNextPeriod, Dt_IsColseForTransfer
    FROM DateTable ORDER BY Dt_ID
  `);
  let n = 0;
  for (const row of r.recordset) {
    const name = row.Dt_Name ?? '';
    const part = name.endsWith('ف1') ? 'f1' : name.endsWith('ف2') ? 'f2' : name.endsWith('ف3') ? 'f3' : 'f1';
    await pg`
      INSERT INTO billing_periods (
        ecas_id, ecas_db, year, month, part, name, from_date, to_date,
        is_computed, is_locked, allow_pay_for_next_period, is_closed
      )
      VALUES (
        ${row.Dt_ID}, ${ecasDb}, ${row.Yr_ID}, ${row.Mon_ID}, ${part}, ${name},
        ${row.Dt_FromDate}, ${row.Dt_ToDate},
        ${!!row.Dt_IsComputed}, ${!!row.Dt_IsLocked},
        ${!!row.Dt_IsAllowPayForNextPeriod}, ${!!row.Dt_IsColseForTransfer}
      )
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET
        year = EXCLUDED.year,
        month = EXCLUDED.month,
        part = EXCLUDED.part,
        name = EXCLUDED.name,
        from_date = EXCLUDED.from_date,
        to_date = EXCLUDED.to_date,
        is_computed = EXCLUDED.is_computed,
        is_locked = EXCLUDED.is_locked,
        allow_pay_for_next_period = EXCLUDED.allow_pay_for_next_period,
        is_closed = EXCLUDED.is_closed
    `;
    n++;
  }
  return n;
}

async function importCashiers(pg, mssql, ecasDb, defaultStationCode) {
  const r = await mssql.request().query(`
    SELECT Cshr_ID, Cshr_Name FROM CashierData ORDER BY Cshr_ID
  `);
  let n = 0;
  for (const row of r.recordset) {
    const name = (row.Cshr_Name ?? '').trim();
    const isElectronic = /الكترون|إلكترون|اكترون/.test(name);
    await pg`
      INSERT INTO billing_cashiers (station_id, ecas_id, ecas_db, name, is_electronic)
      SELECT id, ${row.Cshr_ID}, ${ecasDb}, ${name}, ${isElectronic}
      FROM billing_stations WHERE code = ${defaultStationCode}
      ON CONFLICT (ecas_db, ecas_id) DO UPDATE SET
        name = EXCLUDED.name,
        is_electronic = EXCLUDED.is_electronic
    `;
    n++;
  }
  return n;
}

async function main() {
  const t = startTimer();
  const pg = pgClient();
  try {
    for (const { code: ecasDb, station: defaultStation, label } of ECAS_DATABASES) {
      console.log(`\n📦 قاعدة ${ecasDb} — ${label}`);
      const mssql = await mssqlPool(ecasDb);
      try {
        const started = new Date();
        let nArea = 0, nBr = 0, nReg = 0, nSq = 0, nAct = 0, nAddr = 0, nTar = 0, nPer = 0, nCsh = 0;

        nArea = await importAreas(pg, mssql, ecasDb, defaultStation);
        console.log(`  ✓ مناطق: ${nArea}`);

        nBr = await importBranches(pg, mssql, ecasDb, defaultStation);
        console.log(`  ✓ فروع: ${nBr}`);

        nReg = await importRegisters(pg, mssql, ecasDb, defaultStation);
        console.log(`  ✓ سجلات: ${nReg}`);

        nSq = await importSquares(pg, mssql, ecasDb, defaultStation);
        console.log(`  ✓ مربعات: ${nSq}`);

        nAct = await importActivityTypes(pg, mssql, ecasDb);
        console.log(`  ✓ أنواع نشاط: ${nAct}`);

        nAddr = await importAddressTypes(pg, mssql, ecasDb);
        console.log(`  ✓ أنواع عنوان: ${nAddr}`);

        nTar = await importTariffSlices(pg, mssql, ecasDb);
        console.log(`  ✓ شرائح تعرفة: ${nTar}`);

        nPer = await importPeriods(pg, mssql, ecasDb);
        console.log(`  ✓ فترات: ${nPer}`);

        nCsh = await importCashiers(pg, mssql, ecasDb, defaultStation);
        console.log(`  ✓ محصّلون: ${nCsh}`);

        await logImportRun(pg, ecasDb, 'stage02_lookups', {
          read: nArea + nBr + nReg + nSq + nAct + nAddr + nTar + nPer + nCsh,
          inserted: nArea + nBr + nReg + nSq + nAct + nAddr + nTar + nPer + nCsh,
          startedAt: started,
        });
      } finally {
        await mssql.close();
      }
    }

    console.log(`\n✅ تمّ في ${t.elapsed()}`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
