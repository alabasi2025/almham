/**
 * 08-network.mjs — استيراد الفيدرات والطبلات من ECAS إلى PostgreSQL
 *
 * يقرأ من: SQL Server (Ecas2673=الدهمية، Ecas2668=الصبالية)
 * يكتب في: PostgreSQL (feeders, panels)
 *
 * الاستخدام:
 *   node backend/scripts/etl/08-network.mjs
 */
import { mssqlPool, pgClient } from './lib.mjs';

const ECAS_DBS = [
  { db: 'Ecas2673', stationKey: 'الدهمية' },
  { db: 'Ecas2668', stationKey: 'الصبالية' },
  { db: 'Ecas2672', stationKey: 'غليل' },
];

async function run() {
  const pg = pgClient();
  let totalFeeders = 0;
  let totalPanels = 0;

  for (const { db: dbName, stationKey } of ECAS_DBS) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📍 ${stationKey} (${dbName})`);
    console.log('='.repeat(50));

    const [stationRow] = await pg`SELECT id FROM stations WHERE name LIKE ${'%' + stationKey + '%'} LIMIT 1`;
    const stationId = stationRow?.id;
    if (!stationId) {
      console.log(`  ⚠️ محطة "${stationKey}" غير موجودة في PostgreSQL — تخطّي`);
      continue;
    }

    const pool = await mssqlPool(dbName);

    // === الفيدرات ===
    const ecasFeeders = await pool.request().query(
      'SELECT LnkP_ID, LnkP_Name, LnkP_Employ FROM LinkPoint ORDER BY LnkP_ID'
    );
    console.log(`\n🔌 فيدرات: ${ecasFeeders.recordset.length}`);

    const feederMap = {};
    for (const f of ecasFeeders.recordset) {
      const code = String(f.LnkP_ID);
      const name = f.LnkP_Name?.trim() || `فيدر ${code}`;

      const existing = await pg`SELECT id FROM feeders WHERE station_id = ${stationId} AND code = ${code} LIMIT 1`;
      if (existing.length > 0) {
        feederMap[f.LnkP_ID] = existing[0].id;
        console.log(`  ➖ ${name} (موجود)`);
      } else {
        const [created] = await pg`
          INSERT INTO feeders (station_id, name, code, status, notes)
          VALUES (${stationId}, ${name}, ${code}, 'active', ${`مستورد من ${dbName}.LinkPoint`})
          RETURNING id
        `;
        feederMap[f.LnkP_ID] = created.id;
        totalFeeders++;
        console.log(`  ✅ ${name}`);
      }
    }

    // === الطبلات/المربعات ===
    const ecasPanels = await pool.request().query(`
      SELECT s.Squr_ID, s.Squr_Name, s.Squr_CashierName,
             s.Squr_TotalCstNumber, s.Squr_Consume,
             (SELECT TOP 1 c.LnkP_ID FROM Customer c WHERE c.Squr_ID = s.Squr_ID AND c.RS_ID = 1) as feederId
      FROM Squares s
      WHERE s.Squr_Name IS NOT NULL AND s.Squr_Name <> '0'
        AND s.Squr_Name NOT LIKE '%ملغ%'
        AND s.Squr_Name NOT LIKE '%محذوف%'
        AND s.Squr_Name NOT LIKE '%الغاء%'
        AND s.Squr_Name NOT LIKE '%مسحوب%'
        AND s.Squr_Name NOT LIKE '%موقفين%'
        AND s.Squr_Name NOT LIKE '%فارغ%'
        AND s.Squr_Name NOT LIKE '%فار%غ%'
      ORDER BY s.Squr_ID
    `);
    console.log(`\n📦 طبلات (بعد فلترة الملغية): ${ecasPanels.recordset.length}`);

    let panelCount = 0;
    for (const p of ecasPanels.recordset) {
      const code = String(p.Squr_ID);
      const name = p.Squr_Name?.trim() || `مربع ${code}`;
      const pgFeederId = p.feederId ? feederMap[p.feederId] || null : null;

      const existing = await pg`SELECT id FROM panels WHERE station_id = ${stationId} AND code = ${code} LIMIT 1`;
      if (existing.length > 0) {
        console.log(`  ➖ ${name} (موجود)`);
        continue;
      }

      await pg`
        INSERT INTO panels (station_id, feeder_id, name, code, type, status, notes)
        VALUES (${stationId}, ${pgFeederId}, ${name}, ${code}, 'meter_box', 'active', ${`مستورد من ${dbName}.Squares — كاشف: ${p.Squr_CashierName || '-'}`})
      `;
      panelCount++;
      totalPanels++;
    }
    console.log(`  ✅ أُضيفت ${panelCount} طبلة`);

    await pool.close();
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 تم الاستيراد: ${totalFeeders} فيدر + ${totalPanels} طبلة`);
  console.log('='.repeat(50));

  await pg.end();
  process.exit(0);
}

run().catch(e => {
  console.error('❌', e);
  process.exit(1);
});
