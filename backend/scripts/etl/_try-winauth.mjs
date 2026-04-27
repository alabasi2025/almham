/**
 * جرب طرق اتصال مختلفة مع nullandnotempty:
 * - Windows Auth
 * - Administrator user (NT + SQL)
 * - SQLEXPRESS + different users
 */
import sql from 'mssql';

async function connect(cfg, label) {
  const pool = new sql.ConnectionPool({ connectionTimeout: 4_000, ...cfg });
  try {
    await pool.connect();
    const r = await pool.request().query(`SELECT @@SERVERNAME AS srv, SUSER_NAME() AS me, IS_SRVROLEMEMBER('sysadmin') AS is_sa`);
    await pool.close();
    return { ok: true, label, ...r.recordset[0] };
  } catch (e) {
    return { ok: false, label, err: e.message.slice(0, 100) };
  }
}

async function main() {
  const attempts = [
    // Windows Auth على كلا instance
    { label: 'ECASDEV + WinAuth (current user)',
      cfg: { server: 'localhost', database: 'master',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false, trustedConnection: true } } },
    { label: 'SQLEXPRESS + WinAuth (current user)',
      cfg: { server: 'localhost', database: 'master',
             options: { instanceName: 'SQLEXPRESS', trustServerCertificate: true, encrypt: false, trustedConnection: true } } },
    // Administrator user + nullandnotempty (SQL login)
    { label: 'ECASDEV + Administrator/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'Administrator', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    { label: 'SQLEXPRESS + Administrator/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'Administrator', password: 'nullandnotempty',
             options: { instanceName: 'SQLEXPRESS', trustServerCertificate: true, encrypt: false } } },
    // NT-style usernames
    { label: 'ECASDEV + .\\Administrator/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: '.\\Administrator', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    // Various user candidates
    { label: 'ECASDEV + admin/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'admin', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    { label: 'ECASDEV + ecas/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'ecas', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    { label: 'ECASDEV + ECAS/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'ECAS', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    { label: 'ECASDEV + dbo/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'dbo', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    // Reverse variations
    { label: 'ECASDEV + sa/ytpmetonduna (reversed)',
      cfg: { server: 'localhost', database: 'master', user: 'sa', password: 'ytpmetonduna',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    // Maybe password IS "null" (interpret "and not empty" as meta description)
    { label: 'ECASDEV + sa/null',
      cfg: { server: 'localhost', database: 'master', user: 'sa', password: 'null',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    // "sa" but with weird case
    { label: 'ECASDEV + SA/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'SA', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    // "sa" is trick — actual login might be builtin\administrators
    { label: 'ECASDEV + BUILTIN\\Administrators/nullandnotempty',
      cfg: { server: 'localhost', database: 'master', user: 'BUILTIN\\Administrators', password: 'nullandnotempty',
             options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false } } },
    // server=.  fallback notation
    { label: '.\\ECASDEV + sa/nullandnotempty',
      cfg: { server: '.\\ECASDEV', database: 'master', user: 'sa', password: 'nullandnotempty',
             options: { trustServerCertificate: true, encrypt: false } } },
    { label: '.\\SQLEXPRESS + sa/nullandnotempty',
      cfg: { server: '.\\SQLEXPRESS', database: 'master', user: 'sa', password: 'nullandnotempty',
             options: { trustServerCertificate: true, encrypt: false } } },
  ];

  for (const a of attempts) {
    const r = await connect(a.cfg, a.label);
    const tag = r.ok ? '✅✅✅' : '❌';
    console.log(`${tag} ${r.label}`);
    if (r.ok) console.log(`    → srv=${r.srv} me=${r.me} sysadmin=${r.is_sa}`);
    else console.log(`    ${r.err}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
