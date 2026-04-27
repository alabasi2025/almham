import crypto from 'node:crypto';

const targets = ['nullandnotempty', 'd3b5f83189c6398c23edb14537d0', '6e756c6c616e646e6f74656d707479'];
const pwds = [
  'Administrator','admin','Admin','ADMIN','123','1234','12345','123456','1234567','12345678',
  '11225511','password','Password','sa','system','System','ecas','ECAS','Ecas',
  '2014','admin2014','Admin2014','ecas2014','Ecas2014','ECAS2014',
  'Ecas@123','mypassword4lonin','zuakha033','nullandnotempty',
  'System PassWord','SystemPassWord','notempty','empty','null',
  'admin123','abc123','qwerty','letmein','welcome','monkey','master',
  'dragon','login','princess','football','shadow','sunshine','trustno1',
  'iloveyou','batman','access','hello','charlie',
  'محمد','العباسي','المدير','admin1','user','test','guest','root',
  'passw0rd','P@ssw0rd','P@ss2014','pass2014','2014pass',
  'administrator2014','Admin@2014','ecas@2014',
  'Hexcell','hexcell','HexCell','yemen','Yemen','YEMEN',
];

console.log('═'.repeat(65));
console.log('🔍 MD5/SHA1 — هل "nullandnotempty" هي hash لكلمة سر؟');
console.log('═'.repeat(65));

// Forward: hash passwords and check if match
for (const p of pwds) {
  const md5hex = crypto.createHash('md5').update(p).digest('hex');
  const md5b64 = crypto.createHash('md5').update(p).digest('base64');
  const sha1hex = crypto.createHash('sha1').update(p).digest('hex');
  const sha256hex = crypto.createHash('sha256').update(p).digest('hex');

  for (const t of targets) {
    if (md5hex === t || md5b64 === t || sha1hex.startsWith(t) || sha256hex.startsWith(t)) {
      console.log(`🚨 "${p}" → ${md5hex === t ? 'MD5hex' : md5b64 === t ? 'MD5b64' : 'SHA'} = "${t}"`);
    }
  }
  if (md5hex.startsWith('6e756c6c') || md5b64.startsWith('null')) {
    console.log(`⚠️  "${p}" MD5hex starts with 6e756c6c (= "null")`);
  }
}

// Reverse: is "nullandnotempty" a known MD5 hash?
console.log('\n🔍 Reverse lookup — هل 6e756c6c616e646e6f74656d707479 هو MD5 معروف؟');
// Check if it could be a truncated hash
const storedHex = '6e756c6c616e646e6f74656d707479'; // 30 hex chars = 15 bytes
console.log(`  Stored hex: ${storedHex} (${storedHex.length/2} bytes)`);
console.log(`  MD5 = 16 bytes = 32 hex chars`);
console.log(`  Missing: ${32 - storedHex.length} hex chars`);

// Try all possible last bytes (00-ff) to complete to 16-byte MD5
console.log('\n🔍 Trying to complete as MD5 with missing last byte:');
for (let b = 0; b < 256; b++) {
  const fullHash = storedHex + b.toString(16).padStart(2, '0');
  // We can't reverse MD5, but we can check common passwords
  for (const p of pwds) {
    const h = crypto.createHash('md5').update(p).digest('hex');
    if (h === fullHash) {
      console.log(`🚨🚨🚨 MD5("${p}") = ${fullHash} — MATCH with last byte 0x${b.toString(16)}!`);
    }
  }
}

// Also check: what if it's stored as HASHBYTES output converted to varchar
// HASHBYTES('MD5', x) returns 16 bytes binary
// When stored in varchar, binary bytes become characters
// The text "nullandnotempty" = bytes [6e,75,6c,6c,61,6e,64,6e,6f,74,65,6d,70,74,79]
// If this IS the binary MD5 output (first 15 bytes), then MD5(password) starts with these bytes
console.log('\n🔍 Brute force: find password whose MD5 binary starts with "nullandnotempty" bytes:');
const targetPrefix = Buffer.from('nullandnotempty');
let found = false;
// Try all 6-digit numbers
for (let n = 0; n <= 9999999 && !found; n++) {
  const p = String(n);
  const hash = crypto.createHash('md5').update(p).digest();
  if (hash.subarray(0, 5).equals(targetPrefix.subarray(0, 5))) {
    console.log(`⚠️  MD5("${p}") starts with same 5 bytes!`);
    if (hash.subarray(0, 15).equals(targetPrefix)) {
      console.log(`🚨🚨🚨 FULL MATCH: MD5("${p}") binary = "nullandnotempty"!`);
      found = true;
    }
  }
}

// Try dictionary words
for (const p of pwds) {
  const hash = crypto.createHash('md5').update(p).digest();
  if (hash.subarray(0, 4).equals(targetPrefix.subarray(0, 4))) {
    console.log(`⚠️  MD5("${p}") binary starts with "null"!`);
  }
  // Also try with UTF-16LE encoding
  const hashU = crypto.createHash('md5').update(Buffer.from(p, 'utf16le')).digest();
  if (hashU.subarray(0, 4).equals(targetPrefix.subarray(0, 4))) {
    console.log(`⚠️  MD5("${p}", UTF16) binary starts with "null"!`);
  }
}

console.log('\n✅ Done');
