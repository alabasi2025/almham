/**
 * فحص BILLING_MANAGERS_LOGIN_HST ـ قد يحتوي على كلمات السر المُدخلة
 */
import sql from 'mssql';

const CONFIG = {
  server: 'localhost',
  user: 'almham_reader',
  password: 'AlhamRead@2026!',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  database: 'Ecas2668',
};

async function main() {
  const pool = new sql.ConnectionPool(CONFIG);
  await pool.connect();

  try {
    // أعمدة
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'BILLING_MANAGERS_LOGIN_HST'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('── الأعمدة ──');
    for (const c of cols.recordset) {
      console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
    }

    // عدد
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM BILLING_MANAGERS_LOGIN_HST`);
    console.log(`\nعدد السجلات: ${cnt.recordset[0].c}`);

    // آخر 20 Administrator
    const r = await pool.request().query(`
      SELECT TOP 20 *
      FROM BILLING_MANAGERS_LOGIN_HST
      WHERE USER_NO IN (-1, -2) OR NAME LIKE '%Administrator%'
      ORDER BY LOG_TIME DESC
    `).catch(async () => {
      // maybe LOG_TIME column doesn't exist, try without ORDER BY
      return pool.request().query(`
        SELECT TOP 20 *
        FROM BILLING_MANAGERS_LOGIN_HST
        WHERE USER_NO IN (-1, -2)
      `);
    });

    console.log(`\n── آخر 20 سجل Administrator ──`);
    for (const row of r.recordset) {
      console.log(JSON.stringify(row));
    }

    // اختياري: كل السجلات للكل (لمعرفة النمط)
    const all = await pool.request().query(`SELECT TOP 30 * FROM BILLING_MANAGERS_LOGIN_HST`);
    console.log(`\n── أول 30 سجل بشكل عام ──`);
    for (const row of all.recordset) {
      console.log(JSON.stringify(row));
    }

  } finally {
    await pool.close();
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
