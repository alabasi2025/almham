/**
 * المحاولة الأخيرة: فك تشفير "nullandnotempty" باعتبارها النسخة المشفّرة من كلمة السر
 * المفتاح: "mypassword4lonin" (من EXE)
 */
import crypto from 'node:crypto';

// ─── RC4 Manual ───
function rc4(key, data) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xFF;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(data.length);
  let ii = 0; j = 0;
  for (let k = 0; k < data.length; k++) {
    ii = (ii + 1) & 0xFF;
    j = (j + S[ii]) & 0xFF;
    [S[ii], S[j]] = [S[j], S[ii]];
    out[k] = data[k] ^ S[(S[ii] + S[j]) & 0xFF];
  }
  return Buffer.from(out);
}

const STORED_PW = 'nullandnotempty';
const storedBytes = [...Buffer.from(STORED_PW)];
const DB_PW_HEX = 'd3b5f83189c6398c23edb14537d0';
const dbPwBytes = [...Buffer.from(DB_PW_HEX, 'hex')];

console.log('═'.repeat(65));
console.log('🔓 المحاولة النهائية: فك "nullandnotempty" كنص مشفّر');
console.log('═'.repeat(65));

// كل المفاتيح المحتملة من EXE
const allKeys = [
  'mypassword4lonin', 'mypassword4login',
  'zuakha033',
  'YIDedCheckLicnce07710114',
  'Litmam4CmprsFile', 'Litmam4DeCmprsFile',
  'Ecas@123', '123', 'Asd@123',
  'ATWAAlregam@123321',
  'Admin@206',
  'Kamaran24', 'wKamaran24',
  'LitN3wYnet_123', 'LitYidSMS@123',
  'Ymax@123', 'YemenID@555', 'PowerMetYm2',
  'Alnajmpower11',
  'H2-Power', 'Ma3berPwr',
  'Administrator', 'administrator', 'ADMINISTRATOR',
  'System PassWord', 'SystemPassWord', 'System',
  '11225511', 'MTEyMjU1MTE',
  'Ecas2673', 'Ecas2668', 'ECAS',
  'HexCell', 'hexcell',
  'sa', 'password', 'Password',
];

// ─── فك "nullandnotempty" بكل مفتاح ───
console.log('\n🧪 [1] RC4 decrypt("nullandnotempty"):');
console.log('─'.repeat(65));
for (const keyStr of allKeys) {
  for (const enc of ['utf8', 'utf16le']) {
    const keyBuf = [...Buffer.from(keyStr, enc)];
    const dec = rc4(keyBuf, storedBytes);
    const text = dec.toString('utf8');
    const latin = dec.toString('latin1');
    if (/^[\x20-\x7E]+$/.test(text)) {
      console.log(`  🚨 RC4("${keyStr}",${enc}) → "${text}"`);
    }
    // أيضاً MD5 كمفتاح
    const md5 = crypto.createHash('md5').update(Buffer.from(keyStr, enc)).digest();
    for (const kl of [5, 8, 16]) {
      const dec2 = rc4([...md5.subarray(0, kl)], storedBytes);
      if (/^[\x20-\x7E]+$/.test(dec2.toString('utf8'))) {
        console.log(`  🚨 RC4(MD5("${keyStr}",${enc})[${kl}]) → "${dec2.toString('utf8')}"`);
      }
    }
  }
}

// ─── فك DB_PassWord بكل مفتاح ───
console.log('\n🧪 [2] RC4 decrypt(DB_PassWord):');
console.log('─'.repeat(65));
for (const keyStr of allKeys) {
  const keyBuf = [...Buffer.from(keyStr)];
  const dec = rc4(keyBuf, dbPwBytes);
  const text = dec.toString('utf8');
  if (/^[\x20-\x7E]+$/.test(text)) {
    console.log(`  🚨 RC4("${keyStr}") → "${text}"`);
  }
  const md5 = crypto.createHash('md5').update(keyStr).digest();
  const dec2 = rc4([...md5], dbPwBytes);
  if (/^[\x20-\x7E]+$/.test(dec2.toString('utf8'))) {
    console.log(`  🚨 RC4(MD5("${keyStr}")) → "${dec2.toString('utf8')}"`);
  }
  // UTF-16LE
  const keyBufU = [...Buffer.from(keyStr, 'utf16le')];
  const dec3 = rc4(keyBufU, dbPwBytes);
  if (/^[\x20-\x7E]+$/.test(dec3.toString('utf8'))) {
    console.log(`  🚨 RC4("${keyStr}",utf16) → "${dec3.toString('utf8')}"`);
  }
}

// ─── Simple XOR (not RC4) decrypt both ───
console.log('\n🧪 [3] XOR بسيط (ليس RC4):');
console.log('─'.repeat(65));
for (const keyStr of allKeys) {
  const keyBuf = Buffer.from(keyStr);
  // XOR nullandnotempty
  const xor1 = storedBytes.map((b, i) => b ^ keyBuf[i % keyBuf.length]);
  const text1 = Buffer.from(xor1).toString('utf8');
  if (/^[\x20-\x7E]+$/.test(text1)) {
    console.log(`  XOR("${keyStr.substring(0,20)}") ⊕ "nullandnotempty" → "${text1}"`);
  }
  // XOR DB_PassWord
  const xor2 = dbPwBytes.map((b, i) => b ^ keyBuf[i % keyBuf.length]);
  const text2 = Buffer.from(xor2).toString('utf8');
  if (/^[\x20-\x7E]+$/.test(text2)) {
    console.log(`  XOR("${keyStr.substring(0,20)}") ⊕ DB_PassWord → "${text2}"`);
  }
}

// ─── ماذا لو "nullandnotempty" XOR DB_PassWord = المفتاح أو كلمة السر؟ ───
console.log('\n🧪 [4] nullandnotempty ⊕ DB_PassWord (أول 14 بايت):');
const xorBoth = storedBytes.slice(0, 14).map((b, i) => b ^ dbPwBytes[i]);
const xorBothText = Buffer.from(xorBoth).toString('utf8');
const xorBothLatin = Buffer.from(xorBoth).toString('latin1');
console.log(`  hex: ${Buffer.from(xorBoth).toString('hex')}`);
console.log(`  utf8: "${xorBothText}"`);
console.log(`  latin1: "${xorBothLatin}"`);

// ─── محاولة DES/3DES لفك nullandnotempty ───
console.log('\n🧪 [5] DES/3DES/AES على "nullandnotempty":');
console.log('─'.repeat(65));
// Pad to 16 bytes
const padded = Buffer.concat([Buffer.from(STORED_PW), Buffer.alloc(1)]);
for (const keyStr of ['mypassword4lonin', 'zuakha033', 'Ecas@123']) {
  const md5k = crypto.createHash('md5').update(keyStr).digest();
  // AES-128 ECB (16 byte key, 16 byte data)
  try {
    const dec = crypto.createDecipheriv('aes-128-ecb', md5k, '');
    dec.setAutoPadding(false);
    const result = Buffer.concat([dec.update(padded), dec.final()]);
    if (/^[\x20-\x7E]+/.test(result.toString('utf8'))) {
      console.log(`  🚨 AES-ECB(MD5("${keyStr}")): "${result.toString('utf8')}"`);
    }
  } catch {}
  // DES-ECB
  try {
    const dec = crypto.createDecipheriv('des-ecb', md5k.subarray(0, 8), '');
    dec.setAutoPadding(false);
    const result = Buffer.concat([dec.update(padded), dec.final()]);
    if (/^[\x20-\x7E]+/.test(result.toString('utf8'))) {
      console.log(`  🚨 DES-ECB(MD5("${keyStr}")[8]): "${result.toString('utf8')}"`);
    }
  } catch {}
}

// ─── ربما كلمة السر مخفية بتقنية steganography في النص ───
console.log('\n🧪 [6] تحليل "nullandnotempty" كأحجية:');
console.log('─'.repeat(65));
console.log(`  الأحرف: ${STORED_PW.split('').join('-')}`);
console.log(`  أول حرف من كل كلمة (null/and/not/empty): n-a-n-e → "nane"`);
console.log(`  آخر حرف: l-d-t-y → "ldty"`);
console.log(`  أحرف فردية (1,3,5...): ${STORED_PW.split('').filter((_, i) => i % 2 === 0).join('')}`);
console.log(`  أحرف زوجية (2,4,6...): ${STORED_PW.split('').filter((_, i) => i % 2 === 1).join('')}`);
console.log(`  عكس: ${STORED_PW.split('').reverse().join('')}`);
console.log(`  بدون "null": "${STORED_PW.replace('null', '')}"`);
console.log(`  بدون "not": "${STORED_PW.replace('not', '')}"`);
console.log(`  بدون "empty": "${STORED_PW.replace('empty', '')}"`);
console.log(`  بدون "and": "${STORED_PW.replace('and', '')}"`);
console.log(`  Atbash (a↔z): ${STORED_PW.split('').map(c => {
  if (c >= 'a' && c <= 'z') return String.fromCharCode(219 - c.charCodeAt(0));
  return c;
}).join('')}`);

// ─── ربما الخدعة في DB_PassWord والمفتاح هو "nullandnotempty" ───
console.log('\n🧪 [7] DB_PassWord مع مفتاح "nullandnotempty":');
console.log('─'.repeat(65));
{
  const keyBuf = [...Buffer.from('nullandnotempty')];
  const dec = rc4(keyBuf, dbPwBytes);
  console.log(`  RC4("nullandnotempty") → DB_PassWord: "${dec.toString('utf8')}" hex:${dec.toString('hex')}`);
  if (/^[\x20-\x7E]+$/.test(dec.toString('utf8'))) {
    console.log('  🚨🚨🚨 مقروء!');
  }
  const md5k = crypto.createHash('md5').update('nullandnotempty').digest();
  const dec2 = rc4([...md5k], dbPwBytes);
  console.log(`  RC4(MD5("nullandnotempty")) → "${dec2.toString('utf8')}" hex:${dec2.toString('hex')}`);

  // XOR
  const xor = dbPwBytes.map((b, i) => b ^ keyBuf[i % keyBuf.length]);
  console.log(`  XOR("nullandnotempty") → "${Buffer.from(xor).toString('utf8')}" hex:${Buffer.from(xor).toString('hex')}`);
}

// ─── ربما مفتاح مركّب ───
console.log('\n🧪 [8] مفاتيح مركّبة (concatenation):');
const combos = [
  'Administratormypassword4lonin',
  'mypassword4loninAdministrator',
  'nullandnotemptymypassword4lonin',
  'mypassword4loninnullandnotempty',
  'Administratornullandnotempty',
  'nullandnotemptyAdministrator',
  'SystemPassWord',
  'System PassWord',
];
for (const k of combos) {
  const dec = rc4([...Buffer.from(k)], dbPwBytes);
  if (/^[\x20-\x7E]+$/.test(dec.toString('utf8'))) {
    console.log(`  🚨 RC4("${k.substring(0,30)}...") → "${dec.toString('utf8')}"`);
  }
}

console.log('\n✅ انتهى');
process.exit(0);
