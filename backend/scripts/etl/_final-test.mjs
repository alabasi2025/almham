/**
 * الاختبار النهائي: محاولة login كـ zuc* و zse* مع nullandnotempty
 */
import sql from 'mssql';

const BASE = {
  server: 'localhost',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 5_000,
};

async function tryLogin(user, password) {
  const pool = new sql.ConnectionPool({ ...BASE, database: 'master', user, password });
  try {
    await pool.connect();
    await pool.close();
    return true;
  } catch (e) {
    return { err: e.message.split('\n')[0].substring(0, 120) };
  }
}

async function main() {
  const users = [
    'zuc2668', 'zuc2673', 'zuc2664', 'zuc2670',
    'zse2668', 'zse2673', 'zse2664', 'zse2670',
    'Admin_Store', 'admin_store', 'AdminStore',
    'sa', 'Administrator', 'ecas', 'ECAS',
    'a_tbu', 'tbu',
  ];
  const passwords = [
    'nullandnotempty',
    '11225511', 'mypassword4lonin', 'mypassword4login',
    'MTEyMjU1MTE', '123', '123123',
  ];

  console.log('╔═══ محاولة كل تركيبات (user × password) ═══╗\n');
  for (const u of users) {
    for (const p of passwords) {
      const r = await tryLogin(u, p);
      if (r === true) {
        console.log(`  ⭐⭐⭐ MATCH: user="${u}"  password="${p}"`);
      }
    }
  }
  console.log('\n(انتهى)');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
