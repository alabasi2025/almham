import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db } from './index.js';
import { billingStations, billingYears } from './schema-billing.js';

const stationsSeed = [
  {
    code: 'dahamiya',
    name: 'الدهمية',
    ecasDb: 'Ecas2673',
    companyName: 'الدهمية',
    sortOrder: 1,
  },
  {
    code: 'sabaliya',
    name: 'الصبالية',
    ecasDb: 'Ecas2668',
    companyName: 'الصبالية',
    sortOrder: 2,
  },
  {
    code: 'ghulail',
    name: 'غليل',
    ecasDb: 'Ecas2672',
    companyName: 'غليل',
    sortOrder: 3,
  },
  {
    code: 'saddam',
    name: 'صدام',
    ecasDb: 'Ecas2664',
    companyName: 'محطة صدام',
    sortOrder: 4,
  },
  {
    code: 'tawfiq',
    name: 'التوفيق',
    ecasDb: 'Ecas2670',
    companyName: 'محطة التوفيق',
    sortOrder: 5,
  },
  {
    code: 'jamal',
    name: 'جمال',
    ecasDb: 'Ecas2668',
    companyName: 'جمال',
    isActive: false,
    sortOrder: 99,
  },
];

const yearsSeed = [2024, 2025, 2026];

async function seedStations() {
  for (const station of stationsSeed) {
    const [existing] = await db
      .select({ id: billingStations.id })
      .from(billingStations)
      .where(eq(billingStations.code, station.code))
      .limit(1);

    if (existing) {
      await db.update(billingStations).set(station as typeof billingStations.$inferInsert).where(eq(billingStations.id, existing.id));
    } else {
      await db.insert(billingStations).values(station as typeof billingStations.$inferInsert);
    }
  }
}

async function seedYears() {
  for (const year of yearsSeed) {
    const [existing] = await db
      .select({ id: billingYears.id })
      .from(billingYears)
      .where(eq(billingYears.year, year))
      .limit(1);

    if (!existing) {
      await db.insert(billingYears).values({ year });
    }
  }
}

async function main() {
  console.log('بدء seed نظام الفوترة Web...');
  await seedStations();
  await seedYears();
  console.log('تم seed نظام الفوترة Web بنجاح.');
}

main().catch((error) => {
  console.error('فشل seed نظام الفوترة Web:', error);
  process.exitCode = 1;
}).finally(async () => {
  await closeDb();
});
