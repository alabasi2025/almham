/**
 * تحليل جنائي عميق لـ ECAS.exe
 * - يستخرج كلمات السر المضمَّنة
 * - يجد cross-references (أي السلاسل قرب أيّها)
 * - يفكّ سلاسل connection السّرّية
 * - يحلّل نمط Lit_*@255 (قد يكون hash+salt)
 */
import { readFileSync, writeFileSync } from 'fs';

const EXE = 'd:/almham/imports/ECAS-App/Electricity Customers Accounts System/Electricity Customers Accounts System.exe';
const buf = readFileSync(EXE);
console.log(`الحجم: ${(buf.length / 1024 / 1024).toFixed(1)} MB\n`);

// استخراج UTF-16LE + ASCII معاً
function extractAll(buf, minLen = 3) {
  const results = [];
  // UTF-16LE
  let cur = [], start = 0;
  for (let i = 0; i < buf.length - 1; i += 2) {
    if (buf[i + 1] === 0 && buf[i] >= 0x20 && buf[i] <= 0x7e) {
      if (cur.length === 0) start = i;
      cur.push(String.fromCharCode(buf[i]));
    } else {
      if (cur.length >= minLen) results.push({ offset: start, text: cur.join(''), type: 'u16' });
      cur = [];
    }
  }
  // ASCII
  cur = []; start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
      if (cur.length === 0) start = i;
      cur.push(String.fromCharCode(buf[i]));
    } else {
      if (cur.length >= minLen) results.push({ offset: start, text: cur.join(''), type: 'ascii' });
      cur = [];
    }
  }
  return results;
}

console.log('استخراج كل السلاسل...');
const allStrings = extractAll(buf, 3);
console.log(`المجموع: ${allStrings.length}\n`);

// فهرس للبحث السريع
const byOffset = new Map();
for (const s of allStrings) byOffset.set(s.offset, s);

function nearbyStrings(offset, radius, type = null) {
  return allStrings.filter(s =>
    Math.abs(s.offset - offset) <= radius
    && (type === null || s.type === type)
    && s.text.length >= 3
  ).sort((a, b) => a.offset - b.offset);
}

// =============================================================================
// 1) تحليل منطقة mypassword4lonin (0x2cdcd0) بعمق
// =============================================================================
console.log('═══════════════════════════════════════════════════════════');
console.log('📍 1. منطقة mypassword4lonin / Administrator (0x2cdcd0)');
console.log('═══════════════════════════════════════════════════════════');
const ctx1 = nearbyStrings(0x2cdcd0, 2000, 'u16');
for (const s of ctx1) {
  const mark = s.offset === 0x2cdcd0 ? ' ← 🎯🎯🎯 PASSWORD' :
               s.offset === 0x2cdcb0 ? ' ← Administrator' : '';
  console.log(`  [0x${s.offset.toString(16)}] "${s.text}"${mark}`);
}

// =============================================================================
// 2) تحليل منطقة zuakha033 (0x2d1dec) بعمق
// =============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📍 2. منطقة zuakha033 / CheckData (0x2d1dec)');
console.log('═══════════════════════════════════════════════════════════');
const ctx2 = nearbyStrings(0x2d1dec, 1000, 'u16');
for (const s of ctx2) {
  const mark = s.offset === 0x2d1dec ? ' ← 🎯 zuakha033' : '';
  console.log(`  [0x${s.offset.toString(16)}] "${s.text}"${mark}`);
}

// =============================================================================
// 3) استخراج كامل لسلسلة sa password (0x3cd938)
// =============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📍 3. سلسلة connection string (sa password leak)');
console.log('═══════════════════════════════════════════════════════════');
// اقرأ 500 بايت مباشرة من الـ buffer كـ UTF-16
function readUtf16At(offset, maxLen = 500) {
  const chars = [];
  for (let i = 0; i < maxLen * 2; i += 2) {
    const low = buf[offset + i];
    const high = buf[offset + i + 1];
    if (high !== 0 || low < 0x20 || low > 0x7e) break;
    chars.push(String.fromCharCode(low));
  }
  return chars.join('');
}
console.log(`[0x3cd938] "${readUtf16At(0x3cd938, 300)}"`);
console.log(`[0x3cc0cc] "${readUtf16At(0x3cc0cc, 300)}"`);
console.log(`[0x446070] "${readUtf16At(0x446070, 300)}"`);

// =============================================================================
// 4) البحث عن كل سلاسل ";Password=XXX" أو "ID=sa;Password=" للعثور على كل التسريبات
// =============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📍 4. كل تسريبات كلمات سر SQL Server');
console.log('═══════════════════════════════════════════════════════════');
const connStrs = allStrings.filter(s =>
  s.type === 'u16' && /Password=|User ID=sa/i.test(s.text)
);
for (const s of connStrs.slice(0, 20)) {
  const full = readUtf16At(s.offset, 400);
  console.log(`  [0x${s.offset.toString(16)}]`);
  console.log(`    "${full}"`);
}

// =============================================================================
// 5) البحث عن كل الهاشات (32 hex = MD5)
// =============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📍 5. كل قيم MD5 hash (32 hex chars)');
console.log('═══════════════════════════════════════════════════════════');
const md5s = allStrings.filter(s =>
  s.type === 'u16' && /^[a-f0-9]{32}$/.test(s.text)
);
console.log(`عدد الهاشات: ${md5s.length}`);
// اعرض كل واحد مع السلسلة قبله (اسم المشروع؟)
for (const s of md5s.slice(0, 40)) {
  // جد أقرب سلسلة قبلها
  const before = allStrings
    .filter(x => x.type === 'u16' && x.offset < s.offset && x.offset > s.offset - 200)
    .sort((a, b) => b.offset - a.offset)[0];
  console.log(`  [0x${s.offset.toString(16)}] ${s.text}  ← قبلها: "${before?.text ?? '?'}"`);
}

// =============================================================================
// 6) البحث عن كل السلاسل التي تبدو كـ Lit_XXX@255 (أسماء مشفّرة)
// =============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📍 6. نمط Lit_*@255 (ربما تطبيق Vigenère/XOR على اسم المشروع)');
console.log('═══════════════════════════════════════════════════════════');
const lits = allStrings.filter(s =>
  s.type === 'u16' && /^Lit[_a-zA-Z0-9-]+@\d+$/.test(s.text)
);
console.log(`عدد: ${lits.length}`);
for (const s of lits.slice(0, 20)) {
  console.log(`  [0x${s.offset.toString(16)}] "${s.text}"`);
}

// =============================================================================
// 7) كل السلاسل من 8-20 حرف، ASCII فقط، تحوي حروف+أرقام (كلمات سر محتملة)
// =============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📍 7. جميع كلمات السر المحتملة في الـ exe');
console.log('═══════════════════════════════════════════════════════════');
const candidates = allStrings.filter(s =>
  s.type === 'u16'
  && s.text.length >= 7 && s.text.length <= 25
  && /^[a-zA-Z0-9@_!#\$\.\-]+$/.test(s.text)
  && /[a-z]/.test(s.text)
  && /[0-9]/.test(s.text)
  && !/^(__|Microsoft|Visual|MSComCt|Painting|MSFlex|Command\d|Picture\d|Timer\d|Frame\d|Check\d|Label\d|Text\d|Option\d|Rs32|DTPicker|Frm[A-Z])/.test(s.text)
  && !s.text.startsWith('rpt9')
  && !s.text.startsWith('ECAS_')
  && !s.text.startsWith('Ecas')
  && !/^[a-f0-9]{32}$/.test(s.text)
);

// تجميع مكرّرات
const uniq = new Map();
for (const s of candidates) {
  if (!uniq.has(s.text)) uniq.set(s.text, []);
  uniq.get(s.text).push(s.offset);
}
const sorted = [...uniq.entries()].sort((a, b) => a[1].length - b[1].length);
console.log(`كلمات فريدة: ${uniq.size}`);
console.log('\nأوّل 100 مرشَّح (الأقلّ تكراراً = الأكثر تشابهاً مع كلمة سر):');
for (const [text, offsets] of sorted.slice(0, 100)) {
  console.log(`  ${text.padEnd(25)}  تكرار: ${offsets.length}  (أوّل: 0x${offsets[0].toString(16)})`);
}

// حفظ كل المرشّحين في ملف
const lines = [
  '=== كلمات سر محتملة مضمَّنة في ECAS.exe ===',
  `عدد: ${uniq.size}`,
  '',
  'الأقل تكراراً أوّلاً (الأكثر تشابهاً مع كلمة سر):',
];
for (const [text, offsets] of sorted) {
  lines.push(`  ${text.padEnd(30)}  ×${offsets.length}  @ [${offsets.slice(0,3).map(o=>'0x'+o.toString(16)).join(', ')}]`);
}
writeFileSync('d:/almham/imports/_deep-forensics.txt', lines.join('\n'), 'utf8');
console.log('\n✅ تقرير كامل في: imports/_deep-forensics.txt');
