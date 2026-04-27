import sql from 'mssql';
const pool = new sql.ConnectionPool({
  server: 'localhost', user: 'almham_reader', password: 'AlhamRead@2026!',
  database: 'Ecas2673',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
});
await pool.connect();
const r = await pool.request().query(`
  SELECT Us_ID, Us_Name, Us_PassWord, Us_PassWordHint,
         CAST(Us_PassWord AS varbinary(MAX)) AS pw_bin,
         DATALENGTH(Us_PassWord) AS dlen
  FROM UserData WHERE Us_ID = -1
`);
const row = r.recordset[0];
console.log('Us_Name:', row.Us_Name);
console.log('Us_PassWord:', JSON.stringify(row.Us_PassWord));
console.log('Hint:', row.Us_PassWordHint);
console.log('Hex:', Buffer.from(row.pw_bin).toString('hex'));
console.log('DLen:', row.dlen);
console.log('Bytes:', [...Buffer.from(row.pw_bin)]);

const r2 = await pool.request().query(`SELECT P FROM BILLING_MANAGERS_USERS WHERE USER_NO = -1`);
console.log('BILLING P:', r2.recordset[0]?.P);

// DB_PassWord
const r3 = await pool.request().query(`SELECT CAST(DB_PassWord AS varbinary(MAX)) AS pw FROM DB_And_Sys_Info`);
console.log('DB_PassWord hex:', Buffer.from(r3.recordset[0].pw).toString('hex'));

await pool.close();
process.exit(0);
