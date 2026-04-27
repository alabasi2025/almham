/**
 * استخراج دقيق لمنطقة CheckData / zuakha033 في ECAS.exe
 * نبحث في منطقة واسعة ونستخرج كل السلاسل بالترتيب
 */
import { readFileSync, writeFileSync } from 'fs';

const EXE = 'd:/almham/imports/ECAS-App/Electricity Customers Accounts System/Electricity Customers Accounts System.exe';

console.log(`قراءة ${EXE}...`);
const buf = readFileSync(EXE);
console.log(`حجم الملف: ${(buf.length / 1024 / 1024).toFixed(1)} ميغا`);

// استخراج كل سلاسل ASCII والـ Unicode في الملف
function extractAsciiStrings(buf, minLen = 4) {
  const strings = [];
  let current = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 0x20 && b <= 0x7e) {
      if (current.length === 0) start = i;
      current.push(String.fromCharCode(b));
    } else {
      if (current.length >= minLen) {
        strings.push({ offset: start, text: current.join('') });
      }
      current = [];
    }
  }
  return strings;
}

console.log('استخراج سلاسل ASCII...');
const strings = extractAsciiStrings(buf, 4);
console.log(`عدد السلاسل: ${strings.length}`);

// 1) كل سلسلة تحوي "zuakha"
console.log('\n🔎 كل مرة تُذكَر فيها "zuakha":');
const zuakha = strings.filter(s => s.text.toLowerCase().includes('zuakha'));
for (const s of zuakha) {
  console.log(`  [0x${s.offset.toString(16)}] "${s.text}"`);
}

// 2) السلاسل حول زوكها (±500 بايت)
if (zuakha.length > 0) {
  const mainOffset = zuakha[0].offset;
  console.log(`\n📍 السلاسل حول 0x${mainOffset.toString(16)} (±500 بايت):`);
  const nearby = strings.filter(s => Math.abs(s.offset - mainOffset) <= 500);
  for (const s of nearby) {
    const marker = s.offset === mainOffset ? ' ← 🎯' : '';
    console.log(`  [0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"${marker}`);
  }
}

// 3) البحث عن كل كلمات "CheckData" و "CheckPW" و "Administrator"
console.log('\n🔎 كل مواضع "CheckData":');
for (const s of strings.filter(s => s.text === 'CheckData')) {
  console.log(`  [0x${s.offset.toString(16)}]`);
}

console.log('\n🔎 كل مواضع "CheckPWIsEquel":');
for (const s of strings.filter(s => s.text === 'CheckPWIsEquel')) {
  console.log(`  [0x${s.offset.toString(16)}]`);
}

console.log('\n🔎 كل مواضع "Administrator":');
for (const s of strings.filter(s => s.text === 'Administrator')) {
  console.log(`  [0x${s.offset.toString(16)}]`);
}

// 4) سلاسل تبدو كـ "كلمة سر مضمَّنة" قرب دوال الفحص
console.log('\n🔎 سلاسل ASCII "مشبوهة" (6-20 حرف، مزيج حروف وأرقام):');
const suspicious = strings.filter(s => {
  const t = s.text;
  return t.length >= 6 && t.length <= 20
    && /^[a-zA-Z0-9@_!#\$\.\-]+$/.test(t)
    && /[a-z]/.test(t)
    && /[0-9]/.test(t)
    && !/^(Microsoft|Windows|VB|Visual|Form|Event|System|Database|Customer|Password|User)/.test(t);
});
console.log(`  عدد: ${suspicious.length}`);
// عرض أوّل 80 فقط
for (const s of suspicious.slice(0, 80)) {
  console.log(`  [0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"`);
}

// 5) اكتب كل المناطق الحرجة في ملف لتحليل لاحق
const outputFile = 'd:/almham/imports/_zuakha-analysis.txt';
const lines = [];
lines.push(`=== تحليل منطقة zuakha / CheckData ===\n`);
lines.push(`\n== كل مواضع "zuakha" ==`);
for (const s of zuakha) lines.push(`[0x${s.offset.toString(16)}] "${s.text}"`);

if (zuakha.length > 0) {
  lines.push(`\n== السلاسل حول 0x${zuakha[0].offset.toString(16)} (±2000 بايت) ==`);
  const nearby = strings.filter(s => Math.abs(s.offset - zuakha[0].offset) <= 2000);
  for (const s of nearby) {
    lines.push(`[0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"`);
  }
}

lines.push(`\n== كل سلاسل ASCII بين 6-20 حرف مع حروف+أرقام (أول 500) ==`);
for (const s of suspicious.slice(0, 500)) {
  lines.push(`[0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"`);
}

writeFileSync(outputFile, lines.join('\n'), 'utf8');
console.log(`\n✅ حُفظ التحليل الكامل في: ${outputFile}`);
