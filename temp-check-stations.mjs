import { pgClient } from './scripts/etl/lib.mjs';

const pg = pgClient();
try {
  const stations = await pg`SELECT id, code, name, is_active FROM billing_stations ORDER BY sort_order`;
  console.log('📍 المحطات الموجودة في نظام الفوترة:');
  stations.forEach(s => {
    console.log(`   ${s.id.toString().padEnd(3)} | ${s.code.padEnd(8)} | ${s.name.padEnd(15)} | ${s.is_active ? '✅ نشط' : '❌ معطل'}`);
  });
} finally {
  await pg.end();
}
