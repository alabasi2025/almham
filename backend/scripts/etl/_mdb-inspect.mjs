/**
 * فحص DataBase.mDb في CMSG_Rptfldr
 * - استخراج الـ strings القابلة للقراءة
 * - البحث عن "admin", "store", "password", "user"
 */
import { readFileSync } from 'fs';

const MDB_PATH = 'd:/almham/imports/ECAS-App-extracted/Electricity Customers Accounts System/CMSG_Rptfldr/DataBase.mDb';

const buf = readFileSync(MDB_PATH);
console.log(`ملف MDB: ${MDB_PATH}`);
console.log(`الحجم: ${buf.length} بايت`);

// Access MDB Jet 4.0 password format:
// يبدأ الملف بـ signature: 00 01 00 00 53 74 61 6e 64 61 72 64 20 4a 65 74 20 44 42
// كلمة السر مخزّنة في offset 0x42 (66) وطولها 20 بايت (مشفّرة XOR بمفتاح ثابت)

console.log('\n── أول 128 بايت hex ──');
for (let i = 0; i < Math.min(128, buf.length); i += 16) {
  const chunk = buf.slice(i, i + 16);
  const hex = [...chunk].map(b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = [...chunk].map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.').join('');
  console.log(`  [${i.toString(16).padStart(4, '0')}] ${hex.padEnd(48)} | ${ascii}`);
}

// signature check
const signature = buf.slice(4, 19).toString('ascii');
console.log(`\nتوقيع الملف: "${signature}"`);

// Jet 4.0 password offset 0x42, 40 bytes
if (signature.startsWith('Standard Jet DB') || signature.startsWith('Standard ACE DB')) {
  console.log('\n── Jet/Access Password (encrypted at 0x42) ──');
  const pwArea = buf.slice(0x42, 0x42 + 40);
  console.log(`  raw hex: ${[...pwArea].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

  // Jet 4.0 password decryption key
  // المفتاح: 13 بايت XOR (للـ Jet 4.0)
  // الكود الكلاسيكي:
  //   for i in 0..39: decrypted[i] = encrypted[i] ^ key[i % 13] ^ rc4_stream[i]
  // الأمر معقد (RC4 + PKCS)، لكن إذا كان Jet 3 (قديم) فـ XOR بـ 13 بايت معروف

  const jet3Key = Buffer.from([
    0x86, 0xfb, 0xec, 0x37, 0x5d, 0x44, 0x9c, 0xfa, 0xc6, 0x5e, 0x28, 0xe6, 0x13
  ]);

  const decrypted = Buffer.alloc(40);
  for (let i = 0; i < 40; i++) {
    decrypted[i] = pwArea[i] ^ jet3Key[i % jet3Key.length];
  }
  console.log(`  Jet3-decrypted hex: ${[...decrypted].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  console.log(`  Jet3-decrypted ascii: "${decrypted.toString('latin1').replace(/[\x00-\x1f]/g, '·')}"`);
  // as UTF-16LE
  const utf16 = decrypted.toString('utf16le').replace(/\u0000+$/, '');
  console.log(`  Jet3-decrypted UTF-16LE: "${utf16.replace(/[\x00-\x1f]/g, '·')}"`);
}

// Extract all printable strings (ASCII + UTF-16LE)
console.log('\n── السلاسل المحتوية على admin/store/pass/user ──');
const keywords = [/admin/i, /store/i, /stor/i, /password/i, /pass/i, /user/i, /pwd/i, /admin_store/i];

// ASCII strings
const asciiStrings = [];
let cur = [];
let curStart = 0;
for (let i = 0; i < buf.length; i++) {
  if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
    if (cur.length === 0) curStart = i;
    cur.push(String.fromCharCode(buf[i]));
  } else {
    if (cur.length >= 4) {
      const s = cur.join('');
      if (keywords.some(k => k.test(s))) asciiStrings.push({ offset: curStart, text: s });
    }
    cur = [];
  }
}

// UTF-16LE strings
const utf16Strings = [];
cur = [];
curStart = 0;
for (let i = 0; i < buf.length - 1; i += 2) {
  if (buf[i + 1] === 0 && buf[i] >= 0x20 && buf[i] <= 0x7e) {
    if (cur.length === 0) curStart = i;
    cur.push(String.fromCharCode(buf[i]));
  } else {
    if (cur.length >= 4) {
      const s = cur.join('');
      if (keywords.some(k => k.test(s))) utf16Strings.push({ offset: curStart, text: s });
    }
    cur = [];
  }
}

console.log(`\n  ASCII (${asciiStrings.length}):`);
for (const s of asciiStrings.slice(0, 50)) {
  console.log(`    [0x${s.offset.toString(16)}] "${s.text}"`);
}

console.log(`\n  UTF-16LE (${utf16Strings.length}):`);
for (const s of utf16Strings.slice(0, 50)) {
  console.log(`    [0x${s.offset.toString(16)}] "${s.text}"`);
}

// Specific search for "Admin" table/user (Access default)
console.log('\n── البحث عن "Admin" كـ user/table ──');
const adminAllAscii = [];
const adminAllU16 = [];
cur = []; curStart = 0;
for (let i = 0; i < buf.length; i++) {
  if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
    if (cur.length === 0) curStart = i;
    cur.push(String.fromCharCode(buf[i]));
  } else {
    if (cur.length >= 4) {
      const s = cur.join('');
      if (s === 'Admin' || s.startsWith('Admin') || s.includes('stor') || s.includes('Stor')) adminAllAscii.push({ offset: curStart, text: s });
    }
    cur = [];
  }
}
for (const s of adminAllAscii.slice(0, 20)) {
  console.log(`    ASCII [0x${s.offset.toString(16)}] "${s.text}"`);
}

process.exit(0);
