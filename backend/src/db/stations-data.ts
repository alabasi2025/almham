/**
 * المصدر الموحد لبيانات المحطات الأربع.
 * يُستخدم من قبل:
 *   - src/db/seed.ts          (CLI: npm run db:seed)
 *   - src/routes/reset.ts     (POST /api/reset/seed)
 */

export const REAL_STATIONS = [
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
