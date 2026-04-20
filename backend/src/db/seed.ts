import { db } from './index.js';
import { stations, employees, tasks } from './schema.js';

async function seed() {
  console.log('🧹 بدء حذف البيانات الوهمية القديمة...');

  try {
    // حذف جميع البيانات القديمة
    console.log('🗑️  حذف المهام القديمة...');
    await db.delete(tasks);
    
    console.log('🗑️  حذف الموظفين القدامى...');
    await db.delete(employees);
    
    console.log('🗑️  حذف المحطات القديمة...');
    await db.delete(stations);
    
    console.log('✅ تم حذف جميع البيانات الوهمية بنجاح!');
    console.log('');
    console.log('🌱 بدء إضافة البيانات الحقيقية...');

    // المحطات الحقيقية
    const stationsData = [
      {
        name: 'محطة الدهمية لتوليد وتوزيع الكهرباء',
        location: 'الدهمية',
        capacity: 1500,
        type: 'توليد وتوزيع',
        status: 'active' as const,
      },
      {
        name: 'محطة الصبالية لتوليد وتوزيع الكهرباء',
        location: 'الصبالية',
        capacity: 1200,
        type: 'توليد وتوزيع',
        status: 'active' as const,
      },
      {
        name: 'محطة جمال لتوليد وتوزيع الكهرباء',
        location: 'جمال',
        capacity: 1800,
        type: 'توليد وتوزيع',
        status: 'active' as const,
      },
      {
        name: 'محطة غليل لتوليد وتوزيع الكهرباء',
        location: 'غليل',
        capacity: 1400,
        type: 'توليد وتوزيع',
        status: 'active' as const,
      },
    ];

    // إضافة المحطات الحقيقية
    for (const station of stationsData) {
      const [created] = await db.insert(stations).values(station).returning();
      console.log(`✅ تمت إضافة: ${station.name}`);
    }

    console.log('');
    console.log('🎉 تمت إضافة المحطات الحقيقية بنجاح!');
    console.log(`📊 إجمالي المحطات: ${stationsData.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ في تحديث البيانات:', error);
    process.exit(1);
  }
}

seed();
