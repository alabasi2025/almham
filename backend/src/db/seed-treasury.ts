import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { stations, cashboxes, expenseCategories } from './schema.js';

const EXPENSE_CATEGORIES = [
  { name: 'ديزل', icon: 'local_gas_station', color: '#f59e0b' },
  { name: 'رواتب', icon: 'payments', color: '#3b82f6' },
  { name: 'إيجار الحوش', icon: 'home_work', color: '#8b5cf6' },
  { name: 'قطع غيار', icon: 'settings', color: '#06b6d4' },
  { name: 'زيوت وفلاتر', icon: 'water_drop', color: '#10b981' },
  { name: 'صيانة', icon: 'build', color: '#ec4899' },
  { name: 'كهرباء وماء', icon: 'bolt', color: '#eab308' },
  { name: 'اتصالات', icon: 'phone', color: '#6366f1' },
  { name: 'مواصلات', icon: 'local_shipping', color: '#ef4444' },
  { name: 'مصاريف إدارية', icon: 'receipt', color: '#64748b' },
  { name: 'أخرى', icon: 'more_horiz', color: '#94a3b8' },
];

async function main() {
  console.log('🏦 زرع بيانات الخزينة...');
  console.log('');

  // 1) Expense categories
  console.log('📂 تصنيفات المصاريف:');
  for (const cat of EXPENSE_CATEGORIES) {
    const existing = await db.select().from(expenseCategories).where(eq(expenseCategories.name, cat.name)).limit(1);
    if (!existing[0]) {
      await db.insert(expenseCategories).values(cat);
      console.log(`  + ${cat.name}`);
    } else {
      console.log(`  ➖ ${cat.name} (موجود)`);
    }
  }

  console.log('');
  console.log('💰 الصناديق:');

  // 2) Station cashboxes (one per station)
  const allStations = await db.select().from(stations);
  for (const st of allStations) {
    const shortName = st.name
      .replace(/^محطة\s+/, '')
      .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
    const name = `صندوق ${shortName}`;
    const existing = await db
      .select()
      .from(cashboxes)
      .where(eq(cashboxes.name, name))
      .limit(1);
    if (!existing[0]) {
      await db.insert(cashboxes).values({
        name,
        type: 'station',
        stationId: st.id,
        currency: 'YER',
        openingBalance: '0',
        notes: 'صندوق التحصيل اليومي — مدير المحطة مسؤول',
      });
      console.log(`  + ${name}`);
    } else {
      console.log(`  ➖ ${name} (موجود)`);
    }
  }

  // 3) Exchange offices
  const exchanges = [
    { name: 'الحوشبي', notes: 'الصرّاف الرئيسي' },
    { name: 'النجم', notes: 'الصرّاف البديل/الثانوي' },
  ];
  for (const ex of exchanges) {
    const existing = await db.select().from(cashboxes).where(eq(cashboxes.name, ex.name)).limit(1);
    if (!existing[0]) {
      await db.insert(cashboxes).values({
        name: ex.name,
        type: 'exchange',
        currency: 'YER',
        openingBalance: '0',
        notes: ex.notes,
      });
      console.log(`  + ${ex.name}`);
    } else {
      console.log(`  ➖ ${ex.name} (موجود)`);
    }
  }

  // 4) Digital wallets
  const wallets = [
    {
      name: 'جوالي',
      provider: 'jawali' as const,
      accountNumber: '774424555',
      accountHolder: 'محمد العباسي',
      notes: 'محفظة الشركة الرئيسية — كل المحطات',
    },
    {
      name: 'الكريمي',
      provider: 'kuraimi' as const,
      accountHolder: 'محمد العباسي',
      notes: 'للمشتركين الأوف لاين',
    },
    {
      name: 'M-Floos',
      provider: 'mfloos' as const,
      accountHolder: 'محمد العباسي',
      notes: 'للمشتركين الأوف لاين',
    },
    {
      name: 'جيب',
      provider: 'jeeb' as const,
      accountHolder: 'محمد العباسي',
      notes: 'للمشتركين الأوف لاين',
    },
  ];
  for (const w of wallets) {
    const existing = await db.select().from(cashboxes).where(eq(cashboxes.name, w.name)).limit(1);
    if (!existing[0]) {
      await db.insert(cashboxes).values({
        name: w.name,
        type: 'wallet',
        walletProvider: w.provider,
        accountNumber: w.accountNumber ?? null,
        accountHolder: w.accountHolder,
        currency: 'YER',
        openingBalance: '0',
        notes: w.notes,
      });
      console.log(`  + ${w.name}${w.accountNumber ? ' (' + w.accountNumber + ')' : ''}`);
    } else {
      console.log(`  ➖ ${w.name} (موجود)`);
    }
  }

  console.log('');
  console.log('🎉 تمّت زراعة بيانات الخزينة!');

  const counts = {
    cashboxes: (await db.select().from(cashboxes)).length,
    categories: (await db.select().from(expenseCategories)).length,
  };
  console.log(`📊 الصناديق: ${counts.cashboxes}`);
  console.log(`📊 تصنيفات المصاريف: ${counts.categories}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
