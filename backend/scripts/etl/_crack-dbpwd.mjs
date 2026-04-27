/**
 * محاولة فكّ DB_PassWord: d3 b5 f8 31 89 c6 39 8c 23 ed b1 45 37 d0
 *
 * استراتيجيات:
 *   1. XOR بكل قيمة بايت 0x00-0xFF
 *   2. XOR بكل كلمة مشبوهة وجدناها في الـ exe
 *   3. محاولة فكّ XOR ذاتي (repeating key cryptanalysis)
 *   4. Microsoft Access MDB password format (RC4)
 */

const cipher = Buffer.from([0xd3, 0xb5, 0xf8, 0x31, 0x89, 0xc6, 0x39, 0x8c, 0x23, 0xed, 0xb1, 0x45, 0x37, 0xd0]);
console.log(`النص المشفّر (14 بايت): ${[...cipher].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`);

function asciiRatio(buf) {
  let p = 0;
  for (const b of buf) if (b >= 0x20 && b <= 0x7e) p++;
  return p / buf.length;
}

function tryXor(buf, key) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ (typeof key === 'number' ? key : key[i % key.length]);
  }
  return out;
}

// 1) XOR بكل بايت واحد 0-255
console.log('═══ 1. XOR ببايت واحد (0-255) ═══');
for (let k = 0; k < 256; k++) {
  const out = tryXor(cipher, k);
  const ratio = asciiRatio(out);
  if (ratio >= 0.8) {
    console.log(`   key=0x${k.toString(16).padStart(2,'0')} → "${out.toString('latin1')}" (${(ratio*100).toFixed(0)}%)`);
  }
}

// 2) XOR بكل كلمة من الـ exe
console.log('\n═══ 2. XOR بكلمات من ECAS.exe ═══');
const keywords = [
  'mypassword4lonin', 'zuakha033', 'YemenID', 'YemenID@555',
  'Administrator', 'admin', 'Admin@206', 'mghrbi', 'mghrbi@255',
  'ecas', 'ECAS', 'ECAS2673', 'Ecas2668', '9990', '9143',
  'NjmStation', 'Lit_NjmStation',
  'Litmam4CmprsFile', 'Litmam4DeCmprsFile',
  'YIDedCheckLicnce07710114',
  'Challengers', 'challengers', 'yemenid',
  'password', 'Password', 'MasterKey', 'masterkey',
  'Ymax', 'US-ye', '255', '1234',
  // Arabic keys
  'كلمةالسر', 'مغربي', 'يمن',
  // VB6 common
  'Microsoft', 'JetEngine', 'Access',
];

for (const k of keywords) {
  const keyBuf = Buffer.from(k, 'utf8');
  const out = tryXor(cipher, keyBuf);
  const ratio = asciiRatio(out);
  if (ratio >= 0.7) {
    console.log(`   key="${k}" → "${out.toString('latin1').replace(/[\x00-\x1f]/g, '·')}" (${(ratio*100).toFixed(0)}%)`);
  }
}

// 3) تحليل نفسه: مؤشرات الخوارزمية
console.log('\n═══ 3. تحليل إحصائي ═══');
const freq = new Map();
for (const b of cipher) freq.set(b, (freq.get(b) || 0) + 1);
const uniques = freq.size;
console.log(`   بايتات فريدة: ${uniques}/14 (${uniques === cipher.length ? 'كل البايتات فريدة → تشفير جيد' : 'توجد تكرارات'})`);

// أعلى 3 قيم
const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
console.log(`   أعلى تردد: ${sorted.slice(0, 3).map(([b, c]) => `0x${b.toString(16)} (×${c})`).join(', ')}`);

// 4) فحص: هل ممكن تكون نصّ مشفّر بـ Microsoft Access CASE 2010+ (AES-128)
console.log('\n═══ 4. فرضيات ═══');
console.log('   طول 14 بايت ليس مضاعفاً لـ 8 أو 16 → ليس AES/DES/3DES block cipher');
console.log('   قد يكون: كلمة سر صريحة مطبَّق عليها XOR مع مفتاح ثابت');
console.log('   أو: كلمة سر نصّية إزاحتها Caesar');

// 5) تجربة فكّ XOR مع أول بايت متوقّع
console.log('\n═══ 5. افتراض أن أول حرف حرف إنجليزي معروف ═══');
// لو كان أول حرف "P" (Password) = 0x50
// XOR key byte 0 = 0xd3 ^ 0x50 = 0x83
// لو كان "p" = 0x70, key = 0xa3
// لو كان "M" = 0x4d, key = 0x9e
// لو كان "a" = 0x61, key = 0xb2
// لو كان "1" = 0x31, key = 0xe2
// لو كان "S" = 0x53, key = 0x80
for (const firstChar of ['P', 'p', 'M', 'm', 'a', '1', 'S', 's', 'L', 'l', 'E', 'e']) {
  const keyByte = cipher[0] ^ firstChar.charCodeAt(0);
  // طبّقه على كل البايتات كـ single-byte XOR
  const out = tryXor(cipher, keyByte);
  const ratio = asciiRatio(out);
  if (ratio >= 0.5) {
    console.log(`   أول='${firstChar}' → key=0x${keyByte.toString(16)} → "${out.toString('latin1').replace(/[\x00-\x1f]/g, '·')}" (${(ratio*100).toFixed(0)}%)`);
  }
}

// 6) هل البايتات تشبه RC4 output؟ (توزيع موحّد)
const avg = [...cipher].reduce((a, b) => a + b, 0) / cipher.length;
console.log(`\n   متوسط البايت: ${avg.toFixed(1)} (RC4 output يعطي ~128)`);

console.log('\n✅ انتهى التحليل');
