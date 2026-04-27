/**
 * فك تشفير DB_PassWord باستخدام مفتاح "mypassword4lonin"
 * المستخرج من EXE — يستخدم Microsoft Base Cryptographic Provider v1.0
 * (عادة RC2/DES/RC4 مع MD5 key derivation)
 */
import crypto from 'node:crypto';
import sql from 'mssql';

const CRYPTO_KEY = 'mypassword4lonin';
const ENCRYPTED_HEX = 'd3b5f83189c6398c23edb14537d0'; // 14 bytes
const encryptedBuf = Buffer.from(ENCRYPTED_HEX, 'hex');

console.log('═'.repeat(65));
console.log('🔓 فك تشفير DB_PassWord بمفتاح "mypassword4lonin"');
console.log('═'.repeat(65));
console.log(`   مفتاح: "${CRYPTO_KEY}"`);
console.log(`   بيانات مشفّرة: ${ENCRYPTED_HEX} (${encryptedBuf.length} bytes)`);
console.log('');

// ─── Key derivation: MD5 hash of the password ───
const md5Key = crypto.createHash('md5').update(CRYPTO_KEY).digest();
const sha1Key = crypto.createHash('sha1').update(CRYPTO_KEY).digest();
const md5KeyAscii = crypto.createHash('md5').update(CRYPTO_KEY, 'ascii').digest();
const md5KeyUtf16 = crypto.createHash('md5').update(Buffer.from(CRYPTO_KEY, 'utf16le')).digest();

console.log(`   MD5(key):       ${md5Key.toString('hex')}`);
console.log(`   SHA1(key):      ${sha1Key.toString('hex')}`);
console.log(`   MD5(key,utf16): ${md5KeyUtf16.toString('hex')}`);
console.log('');

function tryDecrypt(algorithm, key, iv, data, label) {
  try {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAutoPadding(false);
    let dec = decipher.update(data);
    dec = Buffer.concat([dec, decipher.final()]);
    const hex = dec.toString('hex');
    const text = dec.toString('utf8');
    const latin = dec.toString('latin1');
    const printable = /^[\x20-\x7E]+/.test(text);
    if (printable || /^[\x20-\x7E]+/.test(latin)) {
      console.log(`   🚨 ${label}: "${text}" (hex:${hex})`);
    }
    return { hex, text, latin };
  } catch (e) {
    return null;
  }
}

function tryDecryptWithPadding(algorithm, key, iv, data, label) {
  try {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let dec = decipher.update(data);
    dec = Buffer.concat([dec, decipher.final()]);
    const hex = dec.toString('hex');
    const text = dec.toString('utf8');
    const printable = /^[\x20-\x7E]+/.test(text);
    if (printable) {
      console.log(`   🚨 ${label}: "${text}" (hex:${hex})`);
    }
    return { hex, text };
  } catch {
    return null;
  }
}

// ─── Microsoft CryptoAPI: CryptDeriveKey uses MD5 hash truncated to key size ───
// RC2: 40-bit (5 bytes) or 128-bit (16 bytes), CBC, IV=0
// DES: 56-bit (8 bytes), CBC, IV=0
// 3DES: 168-bit (24 bytes), CBC, IV=0
// RC4: stream cipher (no IV)

const keyMaterials = [
  { name: 'MD5(key)', buf: md5Key },
  { name: 'MD5(key,utf16)', buf: md5KeyUtf16 },
  { name: 'SHA1(key)', buf: sha1Key },
  { name: 'raw key', buf: Buffer.from(CRYPTO_KEY) },
];

// We need to handle the fact that the encrypted data is 14 bytes
// DES block = 8 bytes → 14 is not a multiple of 8. Might need padding.
// RC2 block = 8 bytes → same issue
// RC4 = stream cipher → 14 bytes is fine

// Pad to 16 bytes for block ciphers
const padded16 = Buffer.concat([encryptedBuf, Buffer.alloc(2)]);
const padded24 = Buffer.concat([encryptedBuf, Buffer.alloc(10)]);

console.log('🧪 RC4 (stream cipher):');
for (const km of keyMaterials) {
  for (const keyLen of [5, 8, 16, km.buf.length]) {
    try {
      const k = km.buf.subarray(0, Math.min(keyLen, km.buf.length));
      const decipher = crypto.createDecipheriv('rc4', k, '');
      const dec = decipher.update(encryptedBuf);
      const text = dec.toString('utf8');
      const latin = dec.toString('latin1');
      const printable = /^[\x20-\x7E]+$/.test(text);
      const latinPrintable = /^[\x20-\x7E]+$/.test(latin);
      if (printable) {
        console.log(`   🚨🚨 RC4(${km.name}[${keyLen}]): "${text}" (hex:${dec.toString('hex')})`);
      } else if (latinPrintable) {
        console.log(`   ⚠️  RC4(${km.name}[${keyLen}]): latin1="${latin}" (hex:${dec.toString('hex')})`);
      }
    } catch {}
  }
}

// Also try with raw key bytes directly
console.log('\n   RC4 with raw key variations:');
const rawKeyVariations = [
  CRYPTO_KEY,
  CRYPTO_KEY.toLowerCase(),
  CRYPTO_KEY.toUpperCase(),
  'mypassword4login', // typo fix
  'mypassword4logIn',
  'MyPassword4Lonin',
];
for (const keyStr of rawKeyVariations) {
  for (const encoding of ['utf8', 'ascii', 'utf16le']) {
    try {
      const k = Buffer.from(keyStr, encoding);
      const decipher = crypto.createDecipheriv('rc4', k, '');
      const dec = decipher.update(encryptedBuf);
      const text = dec.toString('utf8');
      const latin = dec.toString('latin1');
      if (/^[\x20-\x7E]+$/.test(text)) {
        console.log(`   🚨🚨 RC4("${keyStr}",${encoding}): "${text}"`);
      } else if (/^[\x20-\x7E]+$/.test(latin)) {
        console.log(`   ⚠️  RC4("${keyStr}",${encoding}): latin1="${latin}"`);
      }
    } catch {}
  }
}

console.log('\n🧪 DES-CBC (8-byte key, 8-byte IV):');
for (const km of keyMaterials) {
  const k = km.buf.subarray(0, 8);
  const nullIV = Buffer.alloc(8);
  // 14 bytes isn't multiple of 8, try with padding
  for (const data of [padded16, encryptedBuf]) {
    tryDecrypt('des-cbc', k, nullIV, data, `DES(${km.name},nullIV,${data.length}B)`);
    tryDecryptWithPadding('des-cbc', k, nullIV, data, `DES+pad(${km.name},nullIV,${data.length}B)`);
  }
}

console.log('\n🧪 DES-ECB (8-byte key, no IV):');
for (const km of keyMaterials) {
  const k = km.buf.subarray(0, 8);
  for (const data of [padded16, encryptedBuf]) {
    tryDecrypt('des-ecb', k, '', data, `DES-ECB(${km.name},${data.length}B)`);
  }
}

console.log('\n🧪 RC2-CBC:');
for (const km of keyMaterials) {
  for (const keyLen of [5, 8, 16]) {
    const k = km.buf.subarray(0, Math.min(keyLen, km.buf.length));
    const nullIV = Buffer.alloc(8);
    for (const data of [padded16]) {
      tryDecrypt('rc2-cbc', k, nullIV, data, `RC2(${km.name}[${keyLen}],${data.length}B)`);
    }
  }
}

console.log('\n🧪 3DES (des-ede3-cbc):');
for (const km of keyMaterials) {
  if (km.buf.length >= 24) {
    const k = km.buf.subarray(0, 24);
    const nullIV = Buffer.alloc(8);
    tryDecrypt('des-ede3-cbc', k, nullIV, padded16, `3DES(${km.name})`);
  }
  // Also try key repeated to 24 bytes
  const k24 = Buffer.alloc(24);
  km.buf.copy(k24, 0, 0, Math.min(km.buf.length, 24));
  if (km.buf.length < 24) km.buf.copy(k24, km.buf.length, 0, Math.min(km.buf.length, 24 - km.buf.length));
  const nullIV = Buffer.alloc(8);
  tryDecrypt('des-ede3-cbc', k24, nullIV, padded16, `3DES(${km.name}+repeat)`);
}

// ─── Also try: simple XOR with the key ───
console.log('\n🧪 XOR مباشر مع المفتاح:');
const keyBuf = Buffer.from(CRYPTO_KEY);
const xored = encryptedBuf.map((b, i) => b ^ keyBuf[i % keyBuf.length]);
const xorText = Buffer.from(xored).toString('utf8');
const xorLatin = Buffer.from(xored).toString('latin1');
console.log(`   XOR("${CRYPTO_KEY}"): "${xorText}" hex:${Buffer.from(xored).toString('hex')}`);
console.log(`   XOR latin1: "${xorLatin}"`);

// XOR with MD5 of key
const xoredMd5 = encryptedBuf.map((b, i) => b ^ md5Key[i % md5Key.length]);
console.log(`   XOR(MD5(key)): "${Buffer.from(xoredMd5).toString('utf8')}" hex:${Buffer.from(xoredMd5).toString('hex')}`);
console.log(`   XOR(MD5(key)) latin1: "${Buffer.from(xoredMd5).toString('latin1')}"`);

// ─── Try: CryptoAPI default behavior ───
// In .NET/VB6 with Microsoft Base Cryptographic Provider:
// CryptDeriveKey hashes the password with MD5, then uses first N bytes as key
// Default algorithm is RC4 or RC2 depending on the provider
// For RC4 with Base provider: key = MD5(password), up to 40 bits (5 bytes)

console.log('\n🧪 CryptoAPI simulation (RC4, MD5-derived 5-byte key):');
{
  const k5 = md5Key.subarray(0, 5);
  try {
    const decipher = crypto.createDecipheriv('rc4', k5, '');
    const dec = decipher.update(encryptedBuf);
    console.log(`   Result: "${dec.toString('utf8')}" hex:${dec.toString('hex')}`);
    console.log(`   Latin1: "${dec.toString('latin1')}"`);
  } catch (e) { console.log(`   Error: ${e.message}`); }
}

// Also try full MD5 as RC4 key
console.log('\n🧪 RC4 with full MD5:');
{
  try {
    const decipher = crypto.createDecipheriv('rc4', md5Key, '');
    const dec = decipher.update(encryptedBuf);
    console.log(`   Result: "${dec.toString('utf8')}" hex:${dec.toString('hex')}`);
    console.log(`   Latin1: "${dec.toString('latin1')}"`);
  } catch (e) { console.log(`   Error: ${e.message}`); }
}

// ─── Now try connecting to ECAS databases with possible passwords ───
console.log('\n' + '═'.repeat(65));
console.log('🔌 محاولة الاتصال بـ SQL Server بكلمات سر مستخرجة من EXE:');
console.log('═'.repeat(65));

const possiblePasswords = [
  'mypassword4lonin',
  '123',
  'Ecas@123',
  'sa',
  '',
  '11225511',
  'nullandnotempty',
  'Ecas@9982.zuc',
  'LitN3wYnet_123',
];

for (const pwd of possiblePasswords) {
  try {
    const testPool = new sql.ConnectionPool({
      server: 'localhost',
      user: 'sa',
      password: pwd,
      database: 'Ecas2673',
      options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
      connectionTimeout: 5000,
    });
    await testPool.connect();
    console.log(`   🚨🚨🚨 sa + "${pwd}" → ✅ اتصال ناجح!`);
    await testPool.close();
  } catch (e) {
    console.log(`   ❌ sa + "${pwd}" → فشل (${e.message.substring(0, 60)})`);
  }
}

console.log('\n✅ انتهى');
process.exit(0);
