/**
 * اختبار أمني: محاولة كسر هاش كلمة سر المدير (admin)
 * يختبر: قاموس شائع + كلمات مرتبطة بالمشروع + تركيبات + brute-force محدود
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL غير موجود'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// ─── 1. استخراج الهاش من قاعدة البيانات ───
const { rows } = await client.query(
  `SELECT username, password_hash FROM users WHERE username = 'admin' LIMIT 1`
);
await client.end();

if (!rows.length) { console.error('❌ المستخدم admin غير موجود'); process.exit(1); }

const HASH = rows[0].password_hash;
console.log('═══════════════════════════════════════════════════════════');
console.log('🔐 اختبار أمان كلمة السر — حساب admin');
console.log('═══════════════════════════════════════════════════════════');
console.log(`📋 الهاش: ${HASH}`);
console.log(`📋 خوارزمية: bcrypt (يُستدل من البادئة $2a$ أو $2b$)`);
console.log(`📋 عدد الجولات: ${HASH.split('$')[2]}`);
console.log('');

let found = false;
let attempts = 0;
const startTime = Date.now();

async function tryPassword(password, source) {
  attempts++;
  const match = await bcrypt.compare(password, HASH);
  if (match) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    console.log(`⚠️  تم كشف كلمة السر!`);
    console.log(`   كلمة السر: "${password}"`);
    console.log(`   المصدر: ${source}`);
    console.log(`   عدد المحاولات: ${attempts}`);
    console.log(`   الوقت: ${elapsed} ثانية`);
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    found = true;
    return true;
  }
  return false;
}

// ─── 2. كلمات السر الأكثر شيوعاً عالمياً (Top 100) ───
console.log('📖 المرحلة 1: كلمات السر الأكثر شيوعاً عالمياً...');
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
  'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'letmein', 'football', 'shadow', 'michael', 'computer', 'superman',
  '1234567', 'starwars', 'jordan', 'jennifer', 'hunter', 'thomas',
  'charlie', 'andrew', 'jessica', 'ginger', 'joshua', 'pepper',
  'admin', 'Admin', 'admin123', 'Admin123', 'admin@123', 'administrator',
  'Administrator', 'Admin@2024', 'Admin@2025', 'Admin@2026',
  'password123', 'Password1', 'P@ssw0rd', 'P@ssword1', 'Pass@123',
  'Welcome1', 'welcome', 'Welcome123', 'test', 'test123', 'root',
  '123456789', '1234567890', '000000', '654321', 'qwerty123',
  'password1', '1q2w3e4r', 'zaq12wsx', '!@#$%^&*',
];
for (const p of COMMON_PASSWORDS) {
  if (await tryPassword(p, 'كلمات شائعة عالمياً')) break;
}
if (!found) console.log(`   ✅ لم تُكشف (${COMMON_PASSWORDS.length} محاولة)`);

// ─── 3. كلمات مرتبطة بالمشروع والسياق ───
if (!found) {
  console.log('📖 المرحلة 2: كلمات مرتبطة بالمشروع...');
  const PROJECT_WORDS = [
    // اسم النظام وتركيبات
    'almham', 'Almham', 'ALMHAM', 'almham2025', 'almham2026', 'almham2024',
    'Almham2025', 'Almham2026', 'Almham2024',
    'almham@2025', 'almham@2026', 'almham@2024',
    'Almham@2025', 'Almham@2026', 'Almham@2024',
    'almham123', 'Almham123', 'almham!', 'Almham!',

    // العباسي
    'abbasi', 'Abbasi', 'alabbasi', 'Alabbasi',
    'abbasi2025', 'abbasi2026', 'Abbasi2025', 'Abbasi2026',
    'abbasi123', 'Abbasi123', 'abbasi@123',

    // محمد العباسي
    'mohammed', 'Mohammed', 'mohammad', 'Mohammad',
    'mohammed123', 'Mohammed123',
    'mohammed2025', 'mohammed2026',
    'mabbasi', 'Mabbasi',

    // أسماء المحطات
    'dahamiya', 'Dahamiya', 'sabaliya', 'Sabaliya',
    'jamal', 'Jamal', 'ghalil', 'Ghalil',
    'dahamiya123', 'sabaliya123', 'jamal123', 'ghalil123',

    // يمن + كهرباء
    'yemen', 'Yemen', 'yemen123', 'Yemen123',
    'kahraba', 'Kahraba', 'kahraba123',
    'mahata', 'Mahata', 'mahata123',

    // أرقام وسنوات
    '2025', '2026', '2024', '123456', 'abcd1234',
    'qwerty', 'asdf', 'zxcv',

    // علي الصعدي
    'ali.saadi', 'alisaadi', 'saadi', 'Saadi', 'saadi123',
  ];
  for (const p of PROJECT_WORDS) {
    if (await tryPassword(p, 'كلمات مرتبطة بالمشروع')) break;
  }
  if (!found) console.log(`   ✅ لم تُكشف (${PROJECT_WORDS.length} محاولة)`);
}

// ─── 4. تركيبات ذكية (اسم + أرقام + رموز) ───
if (!found) {
  console.log('📖 المرحلة 3: تركيبات ذكية...');
  const bases = ['almham', 'admin', 'abbasi', 'mohammed', 'password', 'yemen', 'kahraba'];
  const suffixes = ['', '1', '12', '123', '1234', '!', '@', '#', '2024', '2025', '2026',
    '@2024', '@2025', '@2026', '!2025', '!2026', '#123', '@123', '!123'];
  let comboCount = 0;
  for (const base of bases) {
    for (const suffix of suffixes) {
      // original, capitalized, UPPER
      for (const variant of [base + suffix, (base[0].toUpperCase() + base.slice(1)) + suffix, base.toUpperCase() + suffix]) {
        if (await tryPassword(variant, 'تركيبات ذكية')) break;
        comboCount++;
      }
      if (found) break;
    }
    if (found) break;
  }
  if (!found) console.log(`   ✅ لم تُكشف (${comboCount} تركيبة)`);
}

// ─── 5. Brute-force على أحرف صغيرة + أرقام (حتى 6 خانات) ───
if (!found) {
  console.log('📖 المرحلة 4: Brute-force (أحرف صغيرة + أرقام، حتى 6 خانات)...');
  console.log('   ⏳ هذا سيأخذ وقتاً بسبب بطء bcrypt (وهذا هو الهدف!)...');
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let bruteCount = 0;
  const MAX_BRUTE = 5000; // نحد المحاولات لأن bcrypt بطيء عمداً

  // نحاول أولاً كلمات من 4-6 أحرف عشوائية
  for (let len = 4; len <= 6 && !found && bruteCount < MAX_BRUTE; len++) {
    for (let i = 0; i < 500 && !found; i++) {
      let pw = '';
      for (let c = 0; c < len; c++) {
        pw += charset[Math.floor(Math.random() * charset.length)];
      }
      if (await tryPassword(pw, `brute-force (${len} أحرف)`)) break;
      bruteCount++;

      if (bruteCount % 100 === 0) {
        const rate = (bruteCount / ((Date.now() - startTime) / 1000)).toFixed(1);
        process.stdout.write(`\r   🔄 ${bruteCount} محاولة... (${rate} محاولة/ثانية)`);
      }
    }
  }
  if (!found) {
    console.log('');
    console.log(`   ✅ لم تُكشف بعد ${bruteCount} محاولة brute-force`);
  }
}

// ─── النتيجة النهائية ───
const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 ملخص الاختبار');
console.log('═══════════════════════════════════════════════════════════');
console.log(`   إجمالي المحاولات: ${attempts}`);
console.log(`   الوقت الكلي: ${totalTime} ثانية`);
console.log(`   معدل المحاولات: ${(attempts / (totalTime || 1)).toFixed(1)} محاولة/ثانية`);
console.log('');

if (found) {
  console.log('🔴 النتيجة: كلمة السر ضعيفة — تم كشفها!');
  console.log('');
  console.log('📋 توصيات لتقوية الأمان:');
  console.log('   1. استخدم كلمة سر 12+ حرف مع أحرف كبيرة وصغيرة وأرقام ورموز');
  console.log('   2. زِد جولات bcrypt إلى 12 أو 14 (أبطأ = أأمن)');
  console.log('   3. أضف rate limiting على محاولات تسجيل الدخول');
  console.log('   4. أضف تأخير بعد كل محاولة فاشلة (progressive delay)');
  console.log('   5. قفل الحساب بعد 5 محاولات فاشلة');
} else {
  console.log('🟢 النتيجة: كلمة السر صامدة أمام هذا الاختبار!');
  console.log('');
  console.log('📋 ملاحظات:');
  console.log('   - bcrypt بطيء عمداً (~100ms لكل محاولة)');
  console.log('   - هذا يجعل brute-force شبه مستحيل عملياً');
  console.log('   - لكن لا يزال مهماً اختيار كلمات سر قوية');
}

console.log('');
process.exit(0);
