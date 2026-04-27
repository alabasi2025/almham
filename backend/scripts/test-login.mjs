import sql from 'mssql';

const pool = new sql.ConnectionPool({
  server: 'localhost', user: 'almham_reader', password: 'AlhamRead@2026!',
  database: 'Ecas2673',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
});
await pool.connect();

// محاكاة تسجيل الدخول — نفس الاستعلام اللي يستخدمه ECAS
const testPassword = 'nullandnotempty';

console.log('═'.repeat(50));
console.log(`🔐 محاولة تسجيل دخول:`);
console.log(`   المستخدم: Administrator`);
console.log(`   كلمة السر: "${testPassword}"`);
console.log('═'.repeat(50));

const r = await pool.request()
  .input('name', 'Administrator')
  .input('pwd', testPassword)
  .query(`SELECT * FROM UserData WHERE Us_Name = @name AND Us_PassWord = @pwd`);

if (r.recordset.length > 0) {
  console.log('\n✅✅✅ تسجيل دخول ناجح!');
  console.log(`   Us_ID: ${r.recordset[0].Us_ID}`);
  console.log(`   Us_Name: ${r.recordset[0].Us_Name}`);
  console.log(`   الكلمة هي فعلاً: "${testPassword}"`);
} else {
  console.log('\n❌ فشل تسجيل الدخول — ليست الكلمة الصحيحة');
}

await pool.close();
process.exit(0);
