import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import {
  stations,
  employees,
  fuelSuppliers,
  supplierSites,
  tankers,
  tanks,
  pumps,
  pumpChannels,
  generators,
} from './schema.js';

async function main() {
  console.log('🌱 زرع بيانات الديزل للصبالية...');

  // 1) محطة الصبالية
  const allStations = await db.select().from(stations);
  const sabaliya = allStations.find((s) => s.name.includes('الصبالية'));
  if (!sabaliya) throw new Error('محطة الصبالية غير موجودة');
  const stationId = sabaliya.id;
  console.log(`✓ المحطة: ${sabaliya.name}`);

  // 2) محمد إبراهيم (فني المولدات)
  const allEmps = await db.select().from(employees);
  const mohammed = allEmps.find((e) => e.name === 'محمد ابراهيم');
  if (mohammed) console.log(`✓ المستلم: ${mohammed.name}`);

  // 3) المورد محمود الحجة + موقعاه
  const existingSuppliers = await db.select().from(fuelSuppliers);
  let supplier = existingSuppliers.find((s) => s.name === 'محمود الحجة');
  if (!supplier) {
    [supplier] = await db.insert(fuelSuppliers).values({ name: 'محمود الحجة' }).returning();
  }
  console.log(`✓ المورد: ${supplier.name}`);

  const existingSites = await db.select().from(supplierSites).where(eq(supplierSites.supplierId, supplier.id));
  const requiredSites = ['محطة الجامعة', 'محطة العوالقي'];
  for (const siteName of requiredSites) {
    if (!existingSites.find((x) => x.name === siteName)) {
      await db.insert(supplierSites).values({ supplierId: supplier.id, name: siteName });
      console.log(`  + موقع: ${siteName}`);
    }
  }

  // 4) الوايت
  const existingTankers = await db.select().from(tankers);
  let tanker = existingTankers.find((t) => t.plate === 'SBLY-01');
  if (!tanker) {
    [tanker] = await db
      .insert(tankers)
      .values({ plate: 'SBLY-01', driverName: 'عادل هجام', compartments: [2970, 3070] })
      .returning();
  }
  console.log(`✓ الوايت: ${tanker.plate} (${tanker.compartments.join(' + ')} = 6040)`);

  // 5) خزانات المحطة
  const existingTanks = await db.select().from(tanks).where(eq(tanks.stationId, stationId));

  type TankRole = 'receiving' | 'main' | 'pre_pump' | 'generator';
  type TankMaterial = 'plastic' | 'steel' | 'rocket' | 'other';

  const upsertTank = async (name: string, role: TankRole, material: TankMaterial, capacityL: number) => {
    const existing = existingTanks.find((t) => t.name === name);
    if (existing) return existing;
    const [row] = await db
      .insert(tanks)
      .values({ stationId, name, role, material, capacityL })
      .returning();
    console.log(`  + خزان: ${name}`);
    return row;
  };

  const tRecv = await upsertTank('خزان الاستلام', 'receiving', 'plastic', 1000);
  const tMain = await upsertTank('الخزان الرئيسي (4 عيون)', 'main', 'steel', 22000);
  const tPre = await upsertTank('صاروخ قبل الطرمبة', 'pre_pump', 'rocket', 2000);
  const tGen1 = await upsertTank('صاروخ مولد بيركنز 2800', 'generator', 'rocket', 1000);
  const tGen2 = await upsertTank('صاروخ مولد بيركنز 2300', 'generator', 'rocket', 1000);
  const tGen3 = await upsertTank('صاروخ مولد كتربلر C15', 'generator', 'rocket', 1000);

  // 6) الطرمبة
  const existingPumps = await db.select().from(pumps).where(eq(pumps.stationId, stationId));
  let pump = existingPumps.find((p) => p.name === 'طرمبة المحطة');
  if (!pump) {
    [pump] = await db
      .insert(pumps)
      .values({ stationId, name: 'طرمبة المحطة', inletsCount: 2, outletsCount: 2, metersCount: 2 })
      .returning();
    console.log(`✓ الطرمبة: ${pump.name} (2 مداخل · 2 مخارج · 2 عدادات)`);
  }

  const existingChannels = await db.select().from(pumpChannels).where(eq(pumpChannels.pumpId, pump.id));
  if (!existingChannels.find((c) => c.channelIndex === 1)) {
    await db.insert(pumpChannels).values({
      pumpId: pump.id,
      channelIndex: 1,
      sourceTankId: tRecv.id,
      destinationTankId: tMain.id,
      meterLabel: 'عداد 1',
    });
    console.log(`  + قناة 1: ${tRecv.name} → ${tMain.name}`);
  }
  if (!existingChannels.find((c) => c.channelIndex === 2)) {
    await db.insert(pumpChannels).values({
      pumpId: pump.id,
      channelIndex: 2,
      sourceTankId: tPre.id,
      destinationTankId: tGen1.id,
      meterLabel: 'عداد 2',
    });
    console.log(`  + قناة 2: ${tPre.name} → خزانات المولدات`);
  }

  // 7) المولدات
  const existingGens = await db.select().from(generators).where(eq(generators.stationId, stationId));

  const upsertGen = async (
    name: string,
    model: string,
    capacityKw: number,
    isBackup: boolean,
    rocketTankId: string
  ) => {
    if (existingGens.find((g) => g.name === name)) return;
    await db.insert(generators).values({ stationId, name, model, capacityKw, isBackup, rocketTankId });
    console.log(`  + مولد: ${name} (${capacityKw}kW${isBackup ? ' احتياطي' : ''})`);
  };

  await upsertGen('مولد بيركنز 2800', 'Perkins 2800', 540, false, tGen1.id);
  await upsertGen('مولد بيركنز 2300', 'Perkins 2300', 320, false, tGen2.id);
  await upsertGen('مولد كتربلر C15', 'Caterpillar C15', 400, true, tGen3.id);

  console.log('');
  console.log('🎉 تمت زراعة بيانات الديزل للصبالية بنجاح!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
