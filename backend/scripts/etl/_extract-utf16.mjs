/**
 * استخراج سلاسل UTF-16LE (طريقة VB6) من ECAS.exe
 * VB6 يخزّن كل السلاسل كـ wide strings
 */
import { readFileSync, writeFileSync } from 'fs';

const EXE = 'd:/almham/imports/ECAS-App/Electricity Customers Accounts System/Electricity Customers Accounts System.exe';

console.log(`قراءة ${EXE}...`);
const buf = readFileSync(EXE);
console.log(`الحجم: ${(buf.length / 1024 / 1024).toFixed(1)} ميغا`);

// استخراج UTF-16LE (ASCII printable only)
function extractUtf16(buf, minLen = 4) {
  const strings = [];
  let current = [];
  let start = 0;
  for (let i = 0; i < buf.length - 1; i += 2) {
    const low = buf[i];
    const high = buf[i + 1];
    // ASCII printable في UTF-16LE
    if (high === 0 && low >= 0x20 && low <= 0x7e) {
      if (current.length === 0) start = i;
      current.push(String.fromCharCode(low));
    } else {
      if (current.length >= minLen) {
        strings.push({ offset: start, text: current.join('') });
      }
      current = [];
    }
  }
  return strings;
}

console.log('استخراج UTF-16LE...');
const strings = extractUtf16(buf, 4);
console.log(`عدد السلاسل: ${strings.length}`);

// 1) كل مرة تظهر فيها zuakha
console.log('\n🔎 بحث "zuakha":');
const z = strings.filter(s => s.text.toLowerCase().includes('zuakha'));
for (const s of z) console.log(`  [0x${s.offset.toString(16)}] "${s.text}"`);

// 2) حول zuakha
if (z.length > 0) {
  const off = z[0].offset;
  console.log(`\n📍 السلاسل حول 0x${off.toString(16)} (±3000 بايت):`);
  const nearby = strings.filter(s => Math.abs(s.offset - off) <= 3000);
  for (const s of nearby) {
    const mark = s.offset === off ? ' ← 🎯 zuakha' : '';
    console.log(`  [0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"${mark}`);
  }
}

// 3) CheckData / CheckPW
console.log('\n🔎 "CheckData":');
for (const s of strings.filter(s => s.text === 'CheckData')) console.log(`  [0x${s.offset.toString(16)}]`);
console.log('\n🔎 "CheckPWIsEquel":');
for (const s of strings.filter(s => s.text === 'CheckPWIsEquel')) console.log(`  [0x${s.offset.toString(16)}]`);
console.log('\n🔎 "Administrator":');
for (const s of strings.filter(s => s.text === 'Administrator')) console.log(`  [0x${s.offset.toString(16)}]`);

// 4) MD5 related
console.log('\n🔎 سلاسل MD5 / Hash:');
for (const s of strings.filter(s => /MD5|Hash|Crypt|Encrypt/i.test(s.text)).slice(0, 30)) {
  console.log(`  [0x${s.offset.toString(16)}] "${s.text}"`);
}

// 5) كل مرة يظهر "Us_PassWord" أو "Password" مع سياق قبلها
console.log('\n🔎 سياقات مفتاحية:');
for (const s of strings.filter(s => /Us_PassWord|PassWord|SELECT.*Us_Name/i.test(s.text)).slice(0, 30)) {
  console.log(`  [0x${s.offset.toString(16)}] "${s.text.slice(0, 120)}"`);
}

// 6) اكتب تقرير شامل
const output = 'd:/almham/imports/_utf16-zuakha.txt';
const lines = [`=== تحليل UTF-16 من ECAS.exe ===\n`];
if (z.length > 0) {
  const off = z[0].offset;
  lines.push(`\n== السلاسل حول zuakha (0x${off.toString(16)}) ±5000 بايت ==`);
  const nearby = strings.filter(s => Math.abs(s.offset - off) <= 5000);
  for (const s of nearby) {
    lines.push(`[0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"`);
  }
}

// اكتب كل السلاسل التي تشبه كلمة سر (6-30 حرف، حروف+أرقام)
const pwLike = strings.filter(s => {
  const t = s.text;
  return t.length >= 6 && t.length <= 30
    && /^[a-zA-Z0-9@_!#\$\.\-]+$/.test(t)
    && /[a-z]/.test(t) && /[0-9]/.test(t);
});
lines.push(`\n\n== سلاسل تشبه كلمات سر (${pwLike.length}) ==`);
for (const s of pwLike.slice(0, 1000)) {
  lines.push(`[0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"`);
}
writeFileSync(output, lines.join('\n'), 'utf8');
console.log(`\n✅ حُفظ: ${output}`);
