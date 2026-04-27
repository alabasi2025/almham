/**
 * CryptoAPI: RC4 مع zero-padded key (40-bit key + 11 zero bytes = 16 bytes)
 * Microsoft Base Cryptographic Provider v1.0 يستخدم هذا النمط
 */
import crypto from 'node:crypto';

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

const DB_PW = Buffer.from('d3b5f83189c6398c23edb14537d0', 'hex');
const STORED_PW = Buffer.from('nullandnotempty');

const keys = [
  'mypassword4lonin',
  'mypassword4login',
  'zuakha033',
  'Ecas@123',
  '123',
  'Administrator',
  'nullandnotempty',
  'System PassWord',
  'YIDedCheckLicnce07710114',
  'Litmam4CmprsFile',
  'Litmam4DeCmprsFile',
  'LitN3wYnet_123',
  'Admin@206',
  'ATWAAlregam@123321',
  'sa',
  'password',
  '11225511',
  'HexCell',
  'Ecas2673',
  'Ecas2668',
];

console.log('═'.repeat(65));
console.log('🔓 CryptoAPI RC4: Zero-Padded Key + Multiple Pad Sizes');
console.log('═'.repeat(65));

function tryKey(keyStr, data, label) {
  const raw = Buffer.from(keyStr);
  const md5 = crypto.createHash('md5').update(keyStr).digest();
  const md5u16 = crypto.createHash('md5').update(Buffer.from(keyStr, 'utf16le')).digest();
  const sha1 = crypto.createHash('sha1').update(keyStr).digest();

  const hashSources = [
    { name: 'MD5', hash: md5 },
    { name: 'MD5-U16', hash: md5u16 },
    { name: 'SHA1', hash: sha1 },
    { name: 'RAW', hash: raw },
  ];

  for (const { name, hash } of hashSources) {
    // Try: first N bytes padded with zeros to various lengths
    for (const effectiveBits of [40, 56, 64, 128]) {
      const effectiveBytes = effectiveBits / 8;
      for (const totalLen of [8, 12, 16, 20, 24, 32]) {
        if (effectiveBytes > hash.length || effectiveBytes > totalLen) continue;
        const paddedKey = Buffer.alloc(totalLen, 0);
        hash.copy(paddedKey, 0, 0, Math.min(effectiveBytes, hash.length));

        const dec = rc4([...paddedKey], [...data]);
        const text = dec.toString('utf8');
        const latin = dec.toString('latin1');
        if (/^[\x20-\x7E]+$/.test(text)) {
          console.log(`🚨🚨 ${label} ${name}[${effectiveBytes}→${totalLen}] "${keyStr}": "${text}"`);
        }
      }
    }
  }
}

console.log('\n📦 فك DB_PassWord:');
console.log('─'.repeat(65));
for (const k of keys) {
  tryKey(k, DB_PW, 'DB_PW');
}

console.log('\n📦 فك "nullandnotempty":');
console.log('─'.repeat(65));
for (const k of keys) {
  tryKey(k, STORED_PW, 'UsPW');
}

// ─── أيضاً: تشفير كلمات سر معروفة ومقارنة ─── 
console.log('\n📦 تشفير كلمات سر → مقارنة مع DB_PassWord:');
console.log('─'.repeat(65));
const candidatePasswords = [
  '123', 'Ecas@123', 'sa', 'password', '11225511', 'admin', 'Administrator',
  'mypassword4lonin', 'LitN3wYnet_123', 'Ecas@9982.zuc',
  'AlhamRead@2026!', 'zuakha033',
];
const md5key = crypto.createHash('md5').update('mypassword4lonin').digest();

for (const pwd of candidatePasswords) {
  const pwdBuf = Buffer.from(pwd);

  // RC4 encrypt with various zero-padded keys
  for (const effB of [5, 8, 16]) {
    for (const totLen of [8, 16]) {
      const paddedKey = Buffer.alloc(totLen, 0);
      md5key.copy(paddedKey, 0, 0, Math.min(effB, md5key.length));

      const enc = rc4([...paddedKey], [...pwdBuf]);
      const encHex = enc.toString('hex');

      if (DB_PW.toString('hex').startsWith(encHex) || encHex === DB_PW.toString('hex')) {
        console.log(`🚨🚨🚨 "${pwd}" → RC4(MD5[${effB}→${totLen}]) = ${encHex} MATCHES!`);
      }
    }
    // Also raw key
    const paddedRaw = Buffer.alloc(16, 0);
    Buffer.from('mypassword4lonin').copy(paddedRaw, 0, 0, Math.min(effB, 16));
    const enc2 = rc4([...paddedRaw], [...pwdBuf]);
    if (enc2.toString('hex') === DB_PW.toString('hex')) {
      console.log(`🚨🚨🚨 "${pwd}" → RC4(RAW[${effB}→16]) MATCHES!`);
    }
  }
}

// ─── FINAL: brute force 3-8 char numeric passwords ───
console.log('\n📦 Brute force أرقام (3-6 أرقام):');
console.log('─'.repeat(65));

// Use the most likely CryptoAPI key: MD5[5] zero-padded to 16
const cryptoKey = Buffer.alloc(16, 0);
md5key.copy(cryptoKey, 0, 0, 5);

for (let n = 100; n <= 999999; n++) {
  const pwd = String(n);
  const pwdBuf = Buffer.from(pwd);
  const enc = rc4([...cryptoKey], [...pwdBuf]);
  if (DB_PW.subarray(0, pwdBuf.length).equals(enc)) {
    console.log(`🚨🚨🚨 Found: "${pwd}" → matches first ${pwdBuf.length} bytes!`);
    // Decrypt full DB_PassWord to verify
    const full = rc4([...cryptoKey], [...DB_PW]);
    console.log(`  Full decrypt: "${full.toString('utf8')}"`);
  }
}

// Also try with raw key zero-padded
const cryptoKey2 = Buffer.alloc(16, 0);
Buffer.from('mypassword4lonin').copy(cryptoKey2, 0, 0, 5);
// Wait, this is the same as taking first 5 chars of the password, not first 5 bytes of MD5
const cryptoKey3 = Buffer.alloc(16, 0);
Buffer.from('mypassword4lonin').copy(cryptoKey3);  // full key, no zero pad truncation

// Try full 16-byte raw key
for (let n = 100; n <= 999999; n++) {
  const pwd = String(n);
  const enc = rc4([...cryptoKey3], [...Buffer.from(pwd)]);
  if (DB_PW.subarray(0, pwd.length).equals(enc)) {
    console.log(`🚨 RAW full key: "${pwd}" matches first ${pwd.length} bytes!`);
    const full = rc4([...cryptoKey3], [...DB_PW]);
    console.log(`  Full: "${full.toString('utf8')}"`);
  }
}

console.log('\n✅ انتهى');
process.exit(0);
