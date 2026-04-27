/**
 * مستخرج سلاسل من الملفات التنفيذية
 * يعمل كـ Linux 'strings' لكن على Windows، يستخرج النصّ من كل ملف
 */
import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

const FILES = [
  'd:/almham/imports/ECAS-App/Electricity Customers Accounts System/ECAS_2673_Mrany_Dohmyah_Ref/ExeRef/esy.exe',
  'd:/almham/imports/ECAS-App/Electricity Customers Accounts System/ECAS_2673_Mrany_Dohmyah_Ref/ExeRef/YemenIDCopLib.DLL',
  'd:/almham/imports/ECAS-App/Electricity Customers Accounts System/ECAS_2673_Mrany_Dohmyah_Ref/ExeRef/hds.exe',
];

const OUTPUT_DIR = 'd:/almham/imports/';

// استخراج السلاسل ASCII بطول 5+ أحرف
function extractStrings(buf, minLen = 5) {
  const strings = [];
  let current = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    // أحرف ASCII قابلة للطباعة
    if (b >= 0x20 && b <= 0x7e) {
      current.push(String.fromCharCode(b));
    } else {
      if (current.length >= minLen) {
        strings.push({ offset: i - current.length, text: current.join('') });
      }
      current = [];
    }
  }
  if (current.length >= minLen) {
    strings.push({ offset: buf.length - current.length, text: current.join('') });
  }
  return strings;
}

// استخراج سلاسل UTF-16LE (VB6/Windows)
function extractUnicodeStrings(buf, minLen = 5) {
  const strings = [];
  let current = [];
  for (let i = 0; i < buf.length - 1; i += 2) {
    const low = buf[i];
    const high = buf[i + 1];
    if (high === 0 && low >= 0x20 && low <= 0x7e) {
      current.push(String.fromCharCode(low));
    } else {
      if (current.length >= minLen) {
        strings.push({ offset: i - current.length * 2, text: current.join('') });
      }
      current = [];
    }
  }
  return strings;
}

for (const file of FILES) {
  console.log(`\n📂 ${basename(file)}`);
  try {
    const buf = readFileSync(file);
    console.log(`   الحجم: ${buf.length} بايت`);

    const ascii = extractStrings(buf, 5);
    const unicode = extractUnicodeStrings(buf, 5);

    console.log(`   ASCII strings: ${ascii.length}`);
    console.log(`   Unicode strings: ${unicode.length}`);

    // اكتب النتائج لملف
    const out = OUTPUT_DIR + basename(file) + '.strings.txt';
    const content = [
      `=== ASCII STRINGS (${ascii.length}) ===`,
      ...ascii.map(s => `[0x${s.offset.toString(16).padStart(6, '0')}] ${s.text}`),
      '',
      `=== UNICODE STRINGS (${unicode.length}) ===`,
      ...unicode.map(s => `[0x${s.offset.toString(16).padStart(6, '0')}] ${s.text}`),
    ].join('\n');
    writeFileSync(out, content, 'utf8');
    console.log(`   → حُفظ: ${out}`);

    // عرض كلمات مشبوهة (تحتوي pass, pwd, admin, hash, secret)
    const allStrings = [...ascii, ...unicode];
    const suspicious = allStrings.filter(s =>
      /pass|pwd|admin|hash|secret|login|user|auth|cred|key|zuakha/i.test(s.text)
    );
    console.log(`\n   🔎 سلاسل مشبوهة (${suspicious.length}):`);
    for (const s of suspicious.slice(0, 50)) {
      console.log(`      [0x${s.offset.toString(16)}] ${s.text}`);
    }
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  }
}

console.log('\n✅ انتهى الاستخراج');
