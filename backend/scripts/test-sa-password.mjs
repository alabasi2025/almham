import sql from 'mssql';

const passwords = [
  'Ecas@123', '123', 'Asd@123', 'sa', 'password', '',
  'zuc2673', 'zuc2668', 'zuc9982',
  'Ecas@9982.zuc', 'LitN3wYnet_123',
  'mypassword4lonin', 'zuakha033',
  '11225511', 'nullandnotempty',
  'admin', 'Admin', 'Administrator',
  'Ecas2673', 'Ecas2668', 'ECAS',
  'AlhamRead@2026!',
  'Kamaran24', 'wKamaran24',
  'Alnajmpower11', 'Admin@206',
  'ATWAAlregam@123321',
  'Ymax@123', 'YemenID@555',
  'PowerMetYm2', 'H2-Power',
  'Litwin11', 'LitYidSMS@123',
  'ecas', 'ECAS@123', 'ecas@123',
  'P@ssw0rd', '1234', '12345', '123456',
  'Ecas@2014', 'ecas2014', 'admin2014',
  'S180718b', '020fAA20', '400fAA12', '0200Ic10',
  'AkrmHathrmyDmtB01', 'Ma3berPwr',
];

console.log('═'.repeat(50));
console.log('🔌 محاولة الاتصال بـ sa على ECASDEV');
console.log('═'.repeat(50));

for (const pwd of passwords) {
  try {
    const pool = new sql.ConnectionPool({
      server: 'localhost',
      user: 'sa',
      password: pwd,
      database: 'Ecas2673',
      options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
      connectionTimeout: 3000,
    });
    await pool.connect();
    console.log(`\n🚨🚨🚨 sa + "${pwd}" → ✅ اتصال ناجح!`);
    console.log(`\nهذه هي كلمة سر Administrator لتسجيل الدخول!`);
    await pool.close();
    process.exit(0);
  } catch {
    // فشل — نكمل
  }
}

console.log('\n❌ لم تنجح أي كلمة سر');
process.exit(1);
