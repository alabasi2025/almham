import { Hono } from 'hono';
import { db } from '../db/index.js';
import { stations, employees, tasks } from '../db/schema.js';

const app = new Hono();

// Endpoint لحذف جميع البيانات وإضافة المحطات الحقيقية
app.post('/seed', async (c) => {
  try {
    // حذف جميع البيانات القديمة
    await db.delete(tasks);
    await db.delete(employees);
    await db.delete(stations);

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

    // إضافة المحطات
    const created = await db.insert(stations).values(stationsData).returning();

    return c.json({
      success: true,
      message: 'تم حذف البيانات القديمة وإضافة المحطات الحقيقية بنجاح',
      stations: created,
      count: created.length
    });
  } catch (error) {
    console.error('خطأ في إعادة تعيين البيانات:', error);
    return c.json({ success: false, error: 'حدث خطأ في إعادة تعيين البيانات' }, 500);
  }
});

export default app;
