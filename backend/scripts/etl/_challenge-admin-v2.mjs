/**
 * تشخيص مركّز: جميع سجلات Administrator عبر كل قواعد ECAS المركّبة
 * + قيم MOBSERL و SCODE و ADJECTIVE
 * + مقارنة مع baseline
 */
import sql from 'mssql';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
};

async function main() {
  const master = new sql.ConnectionPool({ ...CONFIG, database: 'master' });
  await master.connect();
  const dbsR = await master.request().query(
    `SELECT name FROM sys.databases WHERE name LIKE 'Ecas%' ORDER BY name`
  );
  const dbs = dbsR.recordset.map(r => r.name);
  await master.close();

  console.log('قواعد ECAS المركّبة:', dbs.join(', '));
  console.log();
  console.log('DB                USER_NO  NAME              P             len  decoded   MOBSERL            SCODE  ADJECTIVE');
  console.log('-'.repeat(140));

  for (const dbName of dbs) {
    const pool = new sql.ConnectionPool({ ...CONFIG, database: dbName });
    try {
      await pool.connect();
    } catch (e) {
      console.log(`${dbName.padEnd(16)} <conn error: ${e.message}>`);
      continue;
    }

    try {
      const exists = await pool.request().query(
        `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='BILLING_MANAGERS_USERS'`
      );
      if (exists.recordset[0].c === 0) {
        console.log(`${dbName.padEnd(16)} <BILLING_MANAGERS_USERS missing>`);
        continue;
      }

      const r = await pool.request().query(`
        SELECT USER_NO, NAME, P, MOBSERL, SCODE, ADJECTIVE
        FROM BILLING_MANAGERS_USERS
        WHERE NAME LIKE '%Administrator%' OR USER_NO <= 0
        ORDER BY USER_NO
      `);

      for (const row of r.recordset) {
        const pStr = row.P == null ? '' : String(row.P);
        let decoded = '';
        try {
          const d = Buffer.from(pStr, 'base64').toString('utf8');
          if (/^[\x20-\x7e]+$/.test(d)) decoded = d;
        } catch {}
        console.log(
          `${dbName.padEnd(16)} ` +
          `${String(row.USER_NO).padStart(7)}  ` +
          `${(row.NAME ?? '').padEnd(16)}  ` +
          `${pStr.padEnd(13)} ` +
          `${String(pStr.length).padStart(3)}  ` +
          `${decoded.padEnd(9)} ` +
          `${(row.MOBSERL ?? '').padEnd(18)} ` +
          `${(row.SCODE ?? '').padEnd(5)}  ` +
          `${row.ADJECTIVE ?? ''}`
        );
      }

      // نفحص أيضاً UserData
      const ud = await pool.request().query(
        `SELECT Us_ID, Us_Name, Us_PassWord, Us_PassWordHint, Us_UpDateDate
         FROM UserData WHERE Us_Name LIKE '%Administrator%' OR Us_ID <= 0
         ORDER BY Us_ID`
      );
      for (const row of ud.recordset) {
        console.log(
          `${dbName.padEnd(16)} [UserData] Us_ID=${row.Us_ID} "${row.Us_Name}" Us_PassWord="${row.Us_PassWord}" hint="${row.Us_PassWordHint}" updated=${row.Us_UpDateDate?.toISOString()}`
        );
      }

    } finally {
      await pool.close();
    }
    console.log();
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
