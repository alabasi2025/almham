import { Hono } from 'hono';
import { db } from '../db/index.js';
import { stations, employees, tasks } from '../db/schema.js';
import { REAL_STATIONS } from '../db/stations-data.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);
app.use('*', requireRole('admin'));

// Endpoint لحذف جميع البيانات وإضافة المحطات الحقيقية
app.post('/seed', async (c) => {
  try {
    await db.delete(tasks);
    await db.delete(employees);
    await db.delete(stations);

    const created = await db.insert(stations).values(REAL_STATIONS).returning();

    return c.json({
      success: true,
      message: 'تم حذف البيانات القديمة وإضافة المحطات الحقيقية بنجاح',
      stations: created,
      count: created.length,
    });
  } catch (error) {
    console.error('خطأ في إعادة تعيين البيانات:', error);
    return c.json({ success: false, error: 'حدث خطأ في إعادة تعيين البيانات' }, 500);
  }
});

export default app;
