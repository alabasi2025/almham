/**
 * قراءة كاملة لجدول UserData في كل القواعد
 * مع ربط كل كلمة سر باسم المستخدم
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

async function main() {
  for (const { code, label } of ECAS_DATABASES) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📦 ${code} — ${label}`);
    console.log('═'.repeat(80));

    const mssql = await mssqlPool(code);
    try {
      const r = await mssql.request().query(`SELECT * FROM UserData ORDER BY Us_ID`);
      console.log(`عدد المستخدمين: ${r.recordset.length}\n`);
      for (const row of r.recordset) {
        console.log(`  Us_ID=${row.Us_ID}`);
        console.log(`    Us_Name         = "${row.Us_Name}"`);
        console.log(`    Us_PassWord     = ${JSON.stringify(row.Us_PassWord)}`);
        console.log(`    Us_PassWordHint = ${JSON.stringify(row.Us_PassWordHint)}`);
        console.log(`    RU_ID           = ${row.RU_ID}   RW_ID = ${row.RW_ID}`);
        console.log('');
      }
    } finally {
      await mssql.close();
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
