import { pgClient } from './lib.mjs';
const pg = pgClient();
try {
  const queries = [
    ['محطات', 'SELECT COUNT(*)::int AS n FROM billing_stations'],
    ['فترات', 'SELECT COUNT(*)::int AS n FROM billing_periods'],
    ['مربعات', 'SELECT COUNT(*)::int AS n FROM billing_squares'],
    ['محصّلون', 'SELECT COUNT(*)::int AS n FROM billing_cashiers'],
    ['مشتركون', 'SELECT COUNT(*)::int AS n FROM billing_customers'],
    ['فواتير', 'SELECT COUNT(*)::int AS n FROM billing_bills'],
    ['تسديدات', 'SELECT COUNT(*)::int AS n FROM billing_payments'],
  ];
  console.log('\n📊 ملخّص قاعدة البيانات:\n');
  for (const [label, q] of queries) {
    const r = await pg.unsafe(q);
    console.log(`  ${label.padEnd(10)} : ${Number(r[0].n).toLocaleString('en-US')}`);
  }
  const [{ sales }] = await pg`SELECT SUM(consume_price + consume_added_price)::bigint AS sales FROM billing_bills`;
  const [{ collected }] = await pg`SELECT SUM(amount)::bigint AS collected FROM billing_payments`;
  console.log(`\n  💰 مبيعات  : ${Number(sales).toLocaleString('en-US')} ر.ي`);
  console.log(`  💵 تحصيل   : ${Number(collected).toLocaleString('en-US')} ر.ي`);
  const rate = sales > 0 ? (Number(collected) / Number(sales) * 100).toFixed(1) : '-';
  console.log(`  📈 نسبة    : ${rate}%`);

  console.log('\n🏭 توزيع المشتركين بالمحطة:');
  const byStation = await pg`
    SELECT s.name, COUNT(c.id)::int AS n
    FROM billing_stations s LEFT JOIN billing_customers c ON c.station_id = s.id
    GROUP BY s.id, s.name, s.sort_order ORDER BY s.sort_order
  `;
  for (const s of byStation) console.log(`  ${s.name.padEnd(15)} : ${Number(s.n).toLocaleString('en-US')}`);
} finally { await pg.end(); }
