/**
 * تحقق من password_hash لـ sa:
 * صيغة SQL Server 2012+:
 *   0x0200 | salt(4B) | SHA512(UTF16LE(password) || salt)
 */
import crypto from 'crypto';

const fullHash = '0200F677182CA77A721E73FAD939EF199BA56FF15D3FF0235DEDE81EB8C980F50A9FDC48D1C1F58281D0DF59FC4F692D4049F0F5C178EC0D60D224DAC59E192BDDA960CA8027';

const version = fullHash.slice(0, 4);   // 0200
const salt = Buffer.from(fullHash.slice(4, 12), 'hex');        // 4 bytes
const stored = fullHash.slice(12).toLowerCase();                // 128 hex chars (SHA-512)

console.log(`version: 0x${version}`);
console.log(`salt:    ${salt.toString('hex')}`);
console.log(`hash:    ${stored.slice(0,32)}...${stored.slice(-32)}`);
console.log(`hash len: ${stored.length / 2} bytes\n`);

function computeHash(pw) {
  const pwUtf16 = Buffer.from(pw, 'utf16le');
  const input = Buffer.concat([pwUtf16, salt]);
  return crypto.createHash('sha512').update(input).digest('hex');
}

const candidates = [
  'nullandnotempty',
  'Nullandnotempty',
  'NullAndNotEmpty',
  'NULLANDNOTEMPTY',
  'null and not empty',
  'null_and_not_empty',
  'null',
  'not empty',
  'notempty',
  '.',
  '',
  'sa',
  'SA',
  'Sa',
  'Administrator',
  'administrator',
  'Admin_Store',
  'AdminStore',
  'mypassword4lonin',
  '11225511',
  '123',
  'Ecas@123',
  'AlhamRead@2026!',
  'almham_reader',
  'almham',
  'ytpmetonduna',
  'qbas',
  'Qbas',
  'QBAS',
  'Server1',
  'server1',
];

console.log('┌─ مقارنة المرشّحين ─┐');
let found = null;
for (const pw of candidates) {
  const h = computeHash(pw);
  const match = h === stored;
  if (match) {
    console.log(`✅✅✅ MATCH: "${pw}"`);
    found = pw;
  } else {
    console.log(`   ${pw.padEnd(25)} → ${h.slice(0,16)}...`);
  }
}
console.log();
if (found) {
  console.log(`\n⭐ sa password = "${found}"`);
} else {
  console.log('\n(لا تطابق في القائمة — نحتاج توسيع أو brute force على hash مباشرة)');
}
