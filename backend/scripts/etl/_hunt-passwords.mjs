/**
 * صيد كلمات السر — فحص كل جداول ECAS عن أي عمود يشبه حقل كلمة سر
 *
 * يبحث في كل قواعد ECAS عن:
 *  - أعمدة تحتوي: pass, pwd, pw, secret, key, hash, cred, login
 *  - ثم يعرض محتواها (أول 20 صف) للتحقّق البصري
 *
 * القراءة فقط — لا تعديل.
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

const KEYWORDS = ['pass', 'pwd', 'pw', 'secret', 'hash', 'cred', 'login', 'sign', 'auth'];

async function main() {
  for (const { code, label } of ECAS_DATABASES) {
    console.log(`\n${'█'.repeat(70)}`);
    console.log(`📦 ${code} — ${label}`);
    console.log('█'.repeat(70));

    const mssql = await mssqlPool(code);
    try {
      // 1) اجلب كل الأعمدة التي اسمها يحتوي كلمة مفتاحية
      const likeClauses = KEYWORDS.map(k => `COLUMN_NAME LIKE '%${k}%'`).join(' OR ');
      const colsResult = await mssql.request().query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE ${likeClauses}
        ORDER BY TABLE_NAME, COLUMN_NAME
      `);

      console.log(`\n🔎 وجدت ${colsResult.recordset.length} عمود مشبوه`);

      // اجمع الأعمدة حسب الجدول
      const byTable = new Map();
      for (const row of colsResult.recordset) {
        if (!byTable.has(row.TABLE_NAME)) byTable.set(row.TABLE_NAME, []);
        byTable.get(row.TABLE_NAME).push({ name: row.COLUMN_NAME, type: row.DATA_TYPE });
      }

      // 2) لكل جدول: اعرض السجلات التي فيها قيمة غير فارغة
      for (const [tableName, cols] of byTable) {
        console.log(`\n─── جدول: ${tableName} ───`);
        console.log(`   أعمدة مشبوهة: ${cols.map(c => c.name + ' (' + c.type + ')').join(', ')}`);

        // جرب عدّ السجلات
        let count = 0;
        try {
          const r = await mssql.request().query(`SELECT COUNT(*) AS c FROM [${tableName}]`);
          count = r.recordset[0].c;
        } catch (e) {
          console.log(`   ⚠️  تعذّر العدّ: ${e.message}`);
          continue;
        }
        console.log(`   إجمالي السجلات: ${count}`);
        if (count === 0) continue;

        // اعرض كل الأعمدة المشبوهة + أول عمود ID محتمل
        const cleanCols = cols.map(c => `[${c.name}]`).join(', ');
        try {
          const r = await mssql.request().query(`
            SELECT TOP 20 ${cleanCols}
            FROM [${tableName}]
            WHERE ${cols.map(c => `[${c.name}] IS NOT NULL AND LTRIM(RTRIM(CONVERT(NVARCHAR(MAX),[${c.name}]))) <> ''`).join(' OR ')}
          `);
          console.log(`   أول ${r.recordset.length} سجل بقيمة غير فارغة:`);
          for (const row of r.recordset) {
            console.log('     ', JSON.stringify(row));
          }
        } catch (e) {
          console.log(`   ⚠️  تعذّر القراءة: ${e.message}`);
        }
      }
    } finally {
      await mssql.close();
    }
  }

  console.log('\n✅ انتهى البحث');
  process.exit(0);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
