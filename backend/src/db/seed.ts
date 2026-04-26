import { db } from './index.js';
import { stations, employees, tasks } from './schema.js';
import { REAL_STATIONS } from './stations-data.js';

async function seed() {
  console.log('🧹 بدء حذف البيانات الوهمية القديمة...');

  try {
    console.log('🗑️  حذف المهام القديمة...');
    await db.delete(tasks);

    console.log('🗑️  حذف الموظفين القدامى...');
    await db.delete(employees);

    console.log('🗑️  حذف المحطات القديمة...');
    await db.delete(stations);

    console.log('✅ تم حذف جميع البيانات الوهمية بنجاح!');
    console.log('');
    console.log('🌱 بدء إضافة المحطات الحقيقية...');

    for (const station of REAL_STATIONS) {
      await db.insert(stations).values(station).returning();
      console.log(`✅ تمت إضافة: ${station.name}`);
    }

    console.log('');
    console.log('🎉 تمت إضافة المحطات الحقيقية بنجاح!');
    console.log(`📊 إجمالي المحطات: ${REAL_STATIONS.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ في تحديث البيانات:', error);
    process.exit(1);
  }
}

seed();
