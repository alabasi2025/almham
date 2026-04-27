/**
 * جرب sa / nullandnotempty على كل instance محلي
 */
import sql from 'mssql';

async function tryOn(instance, user, pw) {
  const cfg = {
    server: 'localhost',
    options: { instanceName: instance, trustServerCertificate: true, encrypt: false },
    connectionTimeout: 4_000,
    database: 'master',
    user, password: pw,
  };
  const pool = new sql.ConnectionPool(cfg);
  try {
    await pool.connect();
    const r = await pool.request().query(`SELECT @@SERVERNAME AS srv, @@VERSION AS ver, SUSER_NAME() AS me`);
    await pool.close();
    return { ok: true, ...r.recordset[0] };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

async function main() {
  const instances = ['ECASDEV', 'SQLEXPRESS', 'MSSQLSERVER'];
  const creds = [
    ['sa', 'nullandnotempty'],
    ['sa', '11225511'],
    ['sa', 'mypassword4lonin'],
    ['sa', ''],
    ['sa', 'sa'],
    ['sa', '123'],
  ];

  for (const inst of instances) {
    console.log(`\n━━━ instance: ${inst} ━━━`);
    for (const [u, p] of creds) {
      const r = await tryOn(inst, u, p);
      const tag = r.ok ? '✅' : '❌';
      console.log(`  ${tag} ${u}/"${p}"  ${r.ok ? `→ ${r.srv} [${r.me}]` : r.err.slice(0,80)}`);
      if (r.ok && p === 'nullandnotempty') {
        console.log(`\n⭐⭐⭐ FOUND IT: sa / nullandnotempty works on [${inst}] !!!`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
