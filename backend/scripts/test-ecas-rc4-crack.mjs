/**
 * تنفيذ يدوي لـ RC4 + CryptoAPI key derivation
 * لفك تشفير DB_PassWord من ECAS
 */
import crypto from 'node:crypto';

// ─── RC4 Implementation ───
function rc4(key, data) {
  // Key Scheduling Algorithm (KSA)
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xFF;
    [S[i], S[j]] = [S[j], S[i]];
  }
  // Pseudo-Random Generation Algorithm (PRGA)
  const output = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xFF;
    j = (j + S[i]) & 0xFF;
    [S[i], S[j]] = [S[j], S[i]];
    output[k] = data[k] ^ S[(S[i] + S[j]) & 0xFF];
  }
  return Buffer.from(output);
}

const CRYPTO_KEY = 'mypassword4lonin';
const ENCRYPTED = Buffer.from('d3b5f83189c6398c23edb14537d0', 'hex');

console.log('═'.repeat(65));
console.log('🔓 RC4 يدوي + CryptoAPI Key Derivation');
console.log('═'.repeat(65));
console.log(`مفتاح التشفير: "${CRYPTO_KEY}"`);
console.log(`بيانات مشفّرة: ${ENCRYPTED.toString('hex')} (${ENCRYPTED.length} bytes)`);
console.log('');

// ─── مفاتيح مختلفة ───
const md5 = crypto.createHash('md5').update(CRYPTO_KEY).digest();
const md5utf16 = crypto.createHash('md5').update(Buffer.from(CRYPTO_KEY, 'utf16le')).digest();
const sha1 = crypto.createHash('sha1').update(CRYPTO_KEY).digest();
const rawKey = Buffer.from(CRYPTO_KEY);

const keyVariants = [
  { name: 'Raw key (16B)', key: rawKey },
  { name: 'MD5(key) full 16B', key: md5 },
  { name: 'MD5(key) 5B (CryptoAPI Base 40-bit)', key: md5.subarray(0, 5) },
  { name: 'MD5(key) 8B', key: md5.subarray(0, 8) },
  { name: 'MD5(key,utf16) 16B', key: md5utf16 },
  { name: 'MD5(key,utf16) 5B', key: md5utf16.subarray(0, 5) },
  { name: 'SHA1(key) 16B', key: sha1.subarray(0, 16) },
  { name: 'SHA1(key) 5B', key: sha1.subarray(0, 5) },
];

// أيضاً نحاول بتنويعات أسماء المفتاح
const keyStrings = [
  'mypassword4lonin',
  'mypassword4login',  // تصحيح الخطأ
  'MyPassword4Lonin',
  'MYPASSWORD4LONIN',
  'myPassword4Lonin',
  'Mypassword4lonin',
];

console.log('🧪 [1] RC4 مع مشتقات MD5/SHA1:');
console.log('─'.repeat(65));
for (const { name, key } of keyVariants) {
  const dec = rc4([...key], [...ENCRYPTED]);
  const text = dec.toString('utf8');
  const latin = dec.toString('latin1');
  const hex = dec.toString('hex');
  const printable = /^[\x20-\x7E]+$/.test(text);
  const latinPrintable = /^[\x20-\x7E]+$/.test(latin);
  const mark = printable ? '🚨🚨' : latinPrintable ? '⚠️' : '  ';
  console.log(`${mark} ${name.padEnd(35)} → hex:${hex}`);
  if (printable) console.log(`   → TEXT: "${text}"`);
  else if (latinPrintable) console.log(`   → LATIN1: "${latin}"`);
}

console.log('\n🧪 [2] RC4 مع تنويعات اسم المفتاح (raw):');
console.log('─'.repeat(65));
for (const keyStr of keyStrings) {
  for (const encoding of ['utf8', 'utf16le', 'ascii']) {
    const keyBuf = Buffer.from(keyStr, encoding);
    const dec = rc4([...keyBuf], [...ENCRYPTED]);
    const text = dec.toString('utf8');
    const latin = dec.toString('latin1');
    const printable = /^[\x20-\x7E]+$/.test(text);
    const latinPrintable = /^[\x20-\x7E]+$/.test(latin);
    if (printable) {
      console.log(`🚨🚨 RC4("${keyStr}",${encoding}): "${text}"`);
    } else if (latinPrintable) {
      console.log(`⚠️  RC4("${keyStr}",${encoding}): latin1="${latin}" hex:${dec.toString('hex')}`);
    }
  }
  // أيضاً MD5 لكل تنويعة
  const md5v = crypto.createHash('md5').update(keyStr).digest();
  for (const len of [5, 8, 16]) {
    const k = md5v.subarray(0, len);
    const dec = rc4([...k], [...ENCRYPTED]);
    const text = dec.toString('utf8');
    const printable = /^[\x20-\x7E]+$/.test(text);
    if (printable) {
      console.log(`🚨🚨 RC4(MD5("${keyStr}")[${len}]): "${text}"`);
    }
  }
}

// ─── CryptoAPI Key Derivation (more precise) ───
// Microsoft Base Cryptographic Provider uses CryptDeriveKey:
// 1. hash_val = MD5(password)
// 2. Create 64-byte buffers:
//    buffer1 = each byte of hash XOR 0x36, padded with 0x36 to 64 bytes
//    buffer2 = each byte of hash XOR 0x5C, padded with 0x5C to 64 bytes
// 3. Key material = MD5(buffer1) || MD5(buffer2) for enhanced, or just hash_val for base

console.log('\n🧪 [3] CryptDeriveKey المحسّن (HMAC-style):');
console.log('─'.repeat(65));

function cryptDeriveKey(password, keyLen) {
  const hashVal = crypto.createHash('md5').update(password).digest();

  // Method 1: direct hash (simplest)
  const key1 = hashVal.subarray(0, keyLen);

  // Method 2: HMAC-style derivation
  const buf1 = Buffer.alloc(64, 0x36);
  const buf2 = Buffer.alloc(64, 0x5C);
  for (let i = 0; i < hashVal.length; i++) {
    buf1[i] = hashVal[i] ^ 0x36;
    buf2[i] = hashVal[i] ^ 0x5C;
  }
  const derived1 = crypto.createHash('md5').update(buf1).digest();
  const derived2 = crypto.createHash('md5').update(buf2).digest();
  const fullKey = Buffer.concat([derived1, derived2]);
  const key2 = fullKey.subarray(0, keyLen);

  return { direct: key1, derived: key2 };
}

for (const keyStr of keyStrings) {
  for (const keyLen of [5, 8, 16]) {
    const { direct, derived } = cryptDeriveKey(keyStr, keyLen);

    const dec1 = rc4([...direct], [...ENCRYPTED]);
    const dec2 = rc4([...derived], [...ENCRYPTED]);

    if (/^[\x20-\x7E]+$/.test(dec1.toString('utf8'))) {
      console.log(`🚨 Direct MD5("${keyStr}")[${keyLen}]: "${dec1.toString('utf8')}"`);
    }
    if (/^[\x20-\x7E]+$/.test(dec2.toString('utf8'))) {
      console.log(`🚨 Derived("${keyStr}")[${keyLen}]: "${dec2.toString('utf8')}"`);
    }
  }
}

// ─── Brute force XOR with all single-byte keys, applied AFTER RC4 ───
console.log('\n🧪 [4] Brute: RC4 + single-byte XOR:');
console.log('─'.repeat(65));
const bestRc4Key = md5.subarray(0, 5); // CryptoAPI default
const rc4Dec = rc4([...bestRc4Key], [...ENCRYPTED]);
for (let xk = 0; xk < 256; xk++) {
  const final = rc4Dec.map(b => b ^ xk);
  const text = Buffer.from(final).toString('utf8');
  if (/^[\x20-\x7E]+$/.test(text)) {
    console.log(`   RC4(MD5[5]) + XOR(0x${xk.toString(16).padStart(2,'0')}): "${text}"`);
  }
}

// ─── Try also: the key might be derived differently in VB6 ───
// In VB6, CryptHashData might receive the string as ANSI or Unicode
// Let's also try the raw password bytes as RC4 key without any hashing
console.log('\n🧪 [5] RC4 مع مفاتيح إضافية:');
console.log('─'.repeat(65));

const extraKeys = [
  // من connection strings في EXE
  'Ecas@123', '123', 'sa',
  // أرقام الرخصة
  'YIDedCheckLicnce07710114',
  // مفاتيح من forensics
  'Litmam4CmprsFile', 'Litmam4DeCmprsFile',
  'zuakha033',
  // الاسم + كلمة سر
  'Administrator', 'administrator',
  'Administratormypassword4lonin',
  'mypassword4loninAdministrator',
];

for (const keyStr of extraKeys) {
  const keyBuf = Buffer.from(keyStr);
  const dec = rc4([...keyBuf], [...ENCRYPTED]);
  const text = dec.toString('utf8');
  if (/^[\x20-\x7E]+$/.test(text)) {
    console.log(`🚨 RC4("${keyStr}"): "${text}"`);
  }

  // MD5 variations
  const md5v = crypto.createHash('md5').update(keyStr).digest();
  for (const len of [5, 16]) {
    const dec2 = rc4([...md5v.subarray(0, len)], [...ENCRYPTED]);
    if (/^[\x20-\x7E]+$/.test(dec2.toString('utf8'))) {
      console.log(`🚨 RC4(MD5("${keyStr}")[${len}]): "${dec2.toString('utf8')}"`);
    }
  }
}

// ─── What if the encrypted bytes include a header? ───
console.log('\n🧪 [6] فحص: هل أول 2-4 بايت هي header؟');
console.log('─'.repeat(65));
for (let skip = 1; skip <= 4; skip++) {
  const trimmed = ENCRYPTED.subarray(skip);
  const dec = rc4([...Buffer.from(CRYPTO_KEY)], [...trimmed]);
  const text = dec.toString('utf8');
  if (/^[\x20-\x7E]+$/.test(text)) {
    console.log(`🚨 Skip ${skip} bytes + RC4(raw): "${text}"`);
  }
  const dec2 = rc4([...md5.subarray(0, 5)], [...trimmed]);
  if (/^[\x20-\x7E]+$/.test(dec2.toString('utf8'))) {
    console.log(`🚨 Skip ${skip} bytes + RC4(MD5[5]): "${dec2.toString('utf8')}"`);
  }
}

console.log('\n✅ انتهى');
process.exit(0);
