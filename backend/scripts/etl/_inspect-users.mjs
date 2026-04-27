/**
 * أداة تشخيص — فحص مستخدمي ECAS الحقيقيين
 *
 * تتصل بكل قواعد ECAS وتستخرج:
 *  1. جدول BILLING_MANAGERS_USERS (إن وُجد)
 *  2. أسماء فريدة من PaymentData.Pay_UserName و Pay_RefUserName
 *  3. أسماء فريدة من CustomerUpdateDate.User_Name (إن وُجد)
 *
 * لا يُعدّل أي شيء — فقط عرض.
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

async function tableExists(mssql, name) {
  const r = await mssql.request()
    .input('t', name)
    .query(`SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t`);
  return r.recordset[0].c > 0;
}

async function columnExists(mssql, table, column) {
  const r = await mssql.request()
    .input('t', table).input('c', column)
    .query(`SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t AND COLUMN_NAME = @c`);
  return r.recordset[0].c > 0;
}

async function listColumns(mssql, table) {
  const r = await mssql.request()
    .input('t', table)
    .query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t ORDER BY ORDINAL_POSITION`);
  return r.recordset;
}

async function inspectDb(ecasDb, label) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📦 قاعدة ${ecasDb} — ${label}`);
  console.log('═'.repeat(60));

  const mssql = await mssqlPool(ecasDb);
  try {
    // 1. BILLING_MANAGERS_USERS
    const hasMgrUsers = await tableExists(mssql, 'BILLING_MANAGERS_USERS');
    if (hasMgrUsers) {
      console.log('\n✅ جدول BILLING_MANAGERS_USERS موجود');
      const cols = await listColumns(mssql, 'BILLING_MANAGERS_USERS');
      console.log('   الأعمدة:');
      for (const c of cols) console.log(`     - ${c.COLUMN_NAME} (${c.DATA_TYPE})`);

      const countR = await mssql.request().query('SELECT COUNT(*) AS c FROM BILLING_MANAGERS_USERS');
      console.log(`   عدد السجلات: ${countR.recordset[0].c}`);

      const rows = await mssql.request().query('SELECT TOP 50 * FROM BILLING_MANAGERS_USERS');
      console.log('   أول 50 مستخدم:');
      for (const r of rows.recordset) {
        console.log('    ', JSON.stringify(r));
      }
    } else {
      console.log('\n❌ جدول BILLING_MANAGERS_USERS غير موجود');
    }

    // 2. أسماء فريدة من PaymentData
    if (await tableExists(mssql, 'PaymentData')) {
      const hasUserName = await columnExists(mssql, 'PaymentData', 'Pay_UserName');
      const hasRefUserName = await columnExists(mssql, 'PaymentData', 'Pay_RefUserName');

      if (hasUserName) {
        const r = await mssql.request().query(`
          SELECT Pay_UserName AS name, COUNT(*) AS cnt
          FROM PaymentData
          WHERE Pay_UserName IS NOT NULL AND LTRIM(RTRIM(Pay_UserName)) <> ''
          GROUP BY Pay_UserName
          ORDER BY COUNT(*) DESC
        `);
        console.log(`\n📋 أسماء فريدة من PaymentData.Pay_UserName — ${r.recordset.length} اسم:`);
        for (const row of r.recordset.slice(0, 30)) {
          console.log(`   ${String(row.name).padEnd(40)} ${row.cnt} تسديد`);
        }
      }

      if (hasRefUserName) {
        const r = await mssql.request().query(`
          SELECT Pay_RefUserName AS name, COUNT(*) AS cnt
          FROM PaymentData
          WHERE Pay_RefUserName IS NOT NULL AND LTRIM(RTRIM(Pay_RefUserName)) <> ''
          GROUP BY Pay_RefUserName
          ORDER BY COUNT(*) DESC
        `);
        console.log(`\n💵 أسماء فريدة من PaymentData.Pay_RefUserName (الصرّاف) — ${r.recordset.length} اسم:`);
        for (const row of r.recordset.slice(0, 30)) {
          console.log(`   ${String(row.name).padEnd(40)} ${row.cnt} تسديد`);
        }
      }
    }

    // 3. CustomerUpdateDate
    if (await tableExists(mssql, 'CustomerUpdateDate')) {
      if (await columnExists(mssql, 'CustomerUpdateDate', 'User_Name')) {
        const r = await mssql.request().query(`
          SELECT User_Name AS name, COUNT(*) AS cnt
          FROM CustomerUpdateDate
          WHERE User_Name IS NOT NULL AND LTRIM(RTRIM(User_Name)) <> ''
          GROUP BY User_Name
          ORDER BY COUNT(*) DESC
        `);
        console.log(`\n✏️  أسماء فريدة من CustomerUpdateDate.User_Name — ${r.recordset.length} اسم:`);
        for (const row of r.recordset.slice(0, 30)) {
          console.log(`   ${String(row.name).padEnd(40)} ${row.cnt} تعديل`);
        }
      }
    }
  } finally {
    await mssql.close();
  }
}

async function main() {
  for (const { code, label } of ECAS_DATABASES) {
    await inspectDb(code, label);
  }
  console.log('\n✅ انتهى الفحص');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
