/**
 * يعطي almham_reader صلاحية القراءة على Ecas2672 (غليل)
 * يحتاج تشغيل بمستخدم sa أو admin
 */
import sql from 'mssql';

const pool = new sql.ConnectionPool({
  server: 'localhost',
  user: 'sa',
  password: 'nullandnotempty',
  database: 'Ecas2672',
  options: { instanceName: 'ECASDEV', encrypt: false, trustServerCertificate: true },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

await pool.connect();
console.log('Connected to Ecas2672 as sa');

try {
  await pool.request().query("IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'almham_reader') CREATE USER [almham_reader] FOR LOGIN [almham_reader]");
  console.log('✅ User created/exists');
  
  await pool.request().query("ALTER ROLE db_datareader ADD MEMBER [almham_reader]");
  console.log('✅ db_datareader granted');
  
  console.log('🎉 almham_reader now has read access to Ecas2672 (غليل)');
} catch (e) {
  console.error('❌', e.message);
}

await pool.close();
