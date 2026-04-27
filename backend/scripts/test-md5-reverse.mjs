/**
 * الهندسة العكسية: CryptoAPI يستخدم Hash فقط (MD5/SHA1)
 * "zuakha033" هو المفتاح/salt قرب دالة CheckData
 * 
 * السيناريوهات المحتملة:
 * 1. stored = MD5(password) مخزّن كنص
 * 2. stored = MD5(password + salt)
 * 3. stored = MD5(salt + password)
 * 4. stored = HMAC-MD5(password, salt)
 * 5. stored = custom_hash(password, "zuakha033")
 */
import crypto from 'node:crypto';

const stored = 'nullandnotempty';
const storedHex = Buffer.from(stored).toString('hex'); // 6e756c6c616e646e6f74656d707479
const salt = 'zuakha033';

const passwords = [
  'admin','Admin','ADMIN','administrator','Administrator','ADMINISTRATOR',
  '123','1234','12345','123456','1234567','12345678','123456789','1234567890',
  '11225511','password','Password','P@ssw0rd','P@ssword',
  'sa','system','System','SYSTEM','ecas','ECAS','Ecas',
  '2014','admin2014','Admin2014','ecas2014','Ecas2014',
  'Ecas@123','mypassword4lonin','zuakha033',
  'abc123','qwerty','letmein','master','root',
  'almham','almham2026','Almham2026',
  'test','guest','user','admin1','pass',
  'العباسي','محمد','المدير',
  '0000','1111','2222','3333','4444','5555','6666','7777','8888','9999',
  'a','b','1','2','admin123','pass123','test123',
];

console.log('═'.repeat(60));
console.log('🔬 MD5 Hash Reverse: CheckData + zuakha033');
console.log(`   Stored: "${stored}" (hex: ${storedHex})`);
console.log('═'.repeat(60));

function check(label, hashHex) {
  // مقارنة بطرق مختلفة
  const hashBuf = Buffer.from(hashHex, 'hex');
  const hashB64 = hashBuf.toString('base64');
  const hashLatin = hashBuf.toString('latin1');
  const hashAscii = hashBuf.toString('ascii');
  const hashUtf8 = hashBuf.toString('utf8');
  
  if (hashHex === storedHex) return `HEX MATCH`;
  if (hashHex.substring(0, 30) === storedHex) return `HEX PREFIX MATCH (30 chars)`;
  if (hashB64 === stored) return `BASE64 MATCH`;
  if (hashB64.substring(0, 15) === stored) return `BASE64 PREFIX`;
  if (hashHex.substring(0, 15) === stored) return `HEX-as-text PREFIX`;
  
  // الهاش كبايتات → هل أول 15 بايت = "nullandnotempty"?
  if (hashBuf.subarray(0, 15).equals(Buffer.from(stored))) return `BINARY PREFIX MATCH!`;
  if (hashBuf.subarray(0, 15).toString('latin1') === stored) return `BINARY-LATIN1 PREFIX`;
  
  return null;
}

for (const pwd of passwords) {
  const variants = [
    { label: `MD5("${pwd}")`, hash: crypto.createHash('md5').update(pwd).digest('hex') },
    { label: `MD5("${pwd}${salt}")`, hash: crypto.createHash('md5').update(pwd + salt).digest('hex') },
    { label: `MD5("${salt}${pwd}")`, hash: crypto.createHash('md5').update(salt + pwd).digest('hex') },
    { label: `SHA1("${pwd}")`, hash: crypto.createHash('sha1').update(pwd).digest('hex') },
    { label: `HMAC-MD5("${pwd}","${salt}")`, hash: crypto.createHmac('md5', salt).update(pwd).digest('hex') },
    { label: `HMAC-MD5("${salt}","${pwd}")`, hash: crypto.createHmac('md5', pwd).update(salt).digest('hex') },
    { label: `MD5(MD5("${pwd}"))`, hash: crypto.createHash('md5').update(crypto.createHash('md5').update(pwd).digest('hex')).digest('hex') },
    // UTF-16LE (VB6 internal string format)
    { label: `MD5-U16("${pwd}")`, hash: crypto.createHash('md5').update(Buffer.from(pwd, 'utf16le')).digest('hex') },
    { label: `MD5-U16("${pwd}${salt}")`, hash: crypto.createHash('md5').update(Buffer.from(pwd + salt, 'utf16le')).digest('hex') },
  ];
  
  for (const { label, hash } of variants) {
    const match = check(label, hash);
    if (match) {
      console.log(`🚨🚨🚨 ${match}: ${label} = ${hash}`);
    }
  }
}

// Brute force: 0-9999999 with MD5 + salt combinations
console.log('\n🔢 Brute force رقمي مع MD5:');
for (let n = 0; n <= 9999999; n++) {
  const pwd = String(n);
  
  const h1 = crypto.createHash('md5').update(pwd).digest();
  if (h1.subarray(0, 15).equals(Buffer.from(stored))) {
    console.log(`🚨 MD5("${pwd}") binary match!`);
  }
  
  const h2 = crypto.createHash('md5').update(pwd + salt).digest();
  if (h2.subarray(0, 15).equals(Buffer.from(stored))) {
    console.log(`🚨 MD5("${pwd}${salt}") binary match!`);
  }
  
  const h3 = crypto.createHash('md5').update(salt + pwd).digest();
  if (h3.subarray(0, 15).equals(Buffer.from(stored))) {
    console.log(`🚨 MD5("${salt}${pwd}") binary match!`);
  }
  
  if (n % 1000000 === 0 && n > 0) console.log(`  ... ${n/1000000}M`);
}

console.log('\n✅ Done');
process.exit(0);
