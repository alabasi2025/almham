/**
 * تحقّق مباشر — كلمة سر Administrator من SQL Server
 * لا تفسير، فقط عرض القيم الخام كما هي.
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

async function tableExists(mssql, name) {
  const r = await mssql.request()
    .input('t', name)
    .query(`SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t`);
  return r.recordset[0].c > 0;
}

function tryBase64Decode(s) {
  if (!s) return null;
  try {
    const buf = Buffer.from(s, 'base64');
    const str = buf.toString('utf8');
    // تحقّق أن النتيجة قابلة للطباعة
    if (/^[\x20-\x7e\u0600-\u06ff]+$/.test(str)) return str;
    return null;
  } catch {
    return null;
  }
}

async function main() {
  for (const { code, label } of ECAS_DATABASES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📦 ${code} — ${label}`);
    console.log('═'.repeat(70));

    const mssql = await mssqlPool(code);
    try {
      // 1) BILLING_MANAGERS_USERS
      if (await tableExists(mssql, 'BILLING_MANAGERS_USERS')) {
        console.log('\n── BILLING_MANAGERS_USERS ──');
        const r = await mssql.request().query(`SELECT * FROM BILLING_MANAGERS_USERS`);
        for (const row of r.recordset) {
          const name = row.USER_NAME ?? row.UserName ?? row.Name ?? '?';
          const no = row.USER_NO ?? row.UserNo ?? '?';
          const pw = row.P ?? row.Password ?? row.PW ?? null;
          const decoded = tryBase64Decode(pw);
          console.log(`  USER_NO=${no}  NAME="${name}"`);
          console.log(`    raw P     = ${JSON.stringify(pw)}`);
          console.log(`    b64 decode= ${JSON.stringify(decoded)}`);
        }
      } else {
        console.log('\n❌ BILLING_MANAGERS_USERS غير موجود');
      }

      // 2) UserData
      if (await tableExists(mssql, 'UserData')) {
        console.log('\n── UserData (Administrator فقط) ──');
        const r = await mssql.request().query(`
          SELECT * FROM UserData WHERE Us_ID IN (-1, -2) OR Us_Name LIKE '%Administrator%'
        `);
        for (const row of r.recordset) {
          console.log('  row:', JSON.stringify(row, null, 2));
        }
      } else {
        console.log('\n❌ UserData غير موجود');
      }
    } finally {
      await mssql.close();
    }
  }

  console.log('\n✅ انتهى التحقّق');
  process.exit(0);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
