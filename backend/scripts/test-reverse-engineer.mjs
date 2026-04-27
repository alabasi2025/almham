/**
 * هندسة عكسية: فك تشفير "nullandnotempty" باستخدام CryptoAPI
 * VB6 → CryptDeriveKey(CALG_RC4, MD5("mypassword4lonin"), 0)
 * Microsoft Base Provider: 40-bit key + 11 zero-byte salt = 16 bytes
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

const encrypted = Buffer.from('nullandnotempty'); // هذه البايتات المشفّرة
const md5 = crypto.createHash('md5').update('mypassword4lonin').digest();

console.log('═'.repeat(60));
console.log('🔧 الهندسة العكسية: RC4 CryptoAPI');
console.log('═'.repeat(60));
console.log('Encrypted text: "nullandnotempty"');
console.log('Encrypted hex:', encrypted.toString('hex'));
console.log('MD5 key:', md5.toString('hex'));

// CryptoAPI Base Provider: 5 bytes key + 11 zero = 16 bytes total
const key5z = Buffer.alloc(16, 0);
md5.copy(key5z, 0, 0, 5);

// ALL possible key configurations
const keyConfigs = [
  { name: '5B+11z (CryptoAPI Base 40-bit)', key: key5z },
  { name: 'MD5 full 16B', key: md5 },
  { name: 'MD5 first 5B only', key: md5.subarray(0, 5) },
  { name: 'Raw key "mypassword4lonin"', key: Buffer.from('mypassword4lonin') },
  { name: 'Raw 5B+11z', key: (() => { const k = Buffer.alloc(16,0); Buffer.from('mypass').copy(k,0,0,5); return k; })() },
];

console.log('\n🔓 فك "nullandnotempty":');
console.log('─'.repeat(60));
for (const { name, key } of keyConfigs) {
  const dec = rc4([...key], [...encrypted]);
  const hex = dec.toString('hex');
  const utf8 = dec.toString('utf8');
  const latin1 = dec.toString('latin1');
  const win1256 = [...dec].map(b => {
    if (b >= 0x20 && b <= 0x7E) return String.fromCharCode(b);
    if (b >= 0xC0) return `[${b.toString(16)}]`;
    return '.';
  }).join('');
  const printable = /^[\x20-\x7E]+$/.test(utf8);
  console.log(`\n  ${name}:`);
  console.log(`    key hex: ${Buffer.from(key).toString('hex')}`);
  console.log(`    → hex:    ${hex}`);
  console.log(`    → utf8:   "${utf8}"`);
  console.log(`    → latin1: "${latin1}"`);
  console.log(`    → win:    "${win1256}"`);
  console.log(`    → bytes:  [${[...dec].join(', ')}]`);
  if (printable) console.log(`    🚨🚨🚨 مقروء!`);
}

// أيضاً: التحقّق العكسي — تشفير كلمات سر ومقارنة
console.log('\n\n🔄 التحقّق العكسي: تشفير كلمات سر → مقارنة مع "nullandnotempty":');
console.log('─'.repeat(60));
const targetHex = encrypted.toString('hex');
const passwords = [
  'admin','Admin','ADMIN','administrator','Administrator',
  '123','1234','12345','123456','1234567','12345678','123456789',
  '11225511','password','Password','P@ssw0rd',
  'sa','system','System','ecas','ECAS','Ecas',
  '2014','admin2014','Ecas2014','ECAS2014',
  'Ecas@123','mypassword4lonin','zuakha033',
  'abc123','qwerty','letmein','master','dragon',
  'العباسي','محمد','المدير',
  'almham','almham2026','Almham2026',
];

for (const { name, key } of keyConfigs) {
  for (const pwd of passwords) {
    const pwdBuf = Buffer.from(pwd);
    const enc = rc4([...key], [...pwdBuf]);
    if (enc.toString('hex') === targetHex) {
      console.log(`  🚨🚨🚨 "${pwd}" → RC4(${name}) = "nullandnotempty"!`);
    }
    // UTF-16LE
    const pwdBufU = Buffer.from(pwd, 'utf16le');
    const encU = rc4([...key], [...pwdBufU]);
    if (encU.toString('hex') === targetHex) {
      console.log(`  🚨🚨🚨 "${pwd}" (UTF16) → RC4(${name}) = "nullandnotempty"!`);
    }
  }
}

// Brute: 4-8 digit numbers
console.log('\n🔢 Brute force أرقام:');
for (const { name, key } of keyConfigs.slice(0, 3)) {
  for (let n = 0; n <= 99999999; n++) {
    const pwd = String(n);
    const enc = rc4([...key], [...Buffer.from(pwd)]);
    if (enc.toString('hex') === targetHex) {
      console.log(`  🚨🚨🚨 "${pwd}" → RC4(${name}) = "nullandnotempty"!`);
      break;
    }
    if (n % 10000000 === 0 && n > 0) console.log(`    ... checked ${n}M for ${name}`);
  }
}

console.log('\n✅ Done');
process.exit(0);
