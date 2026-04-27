/**
 * تقرير مفصّل — مستخدمو نظام الفوترة القديم (ECAS)
 * يقرأ BILLING_MANAGERS_USERS من كلا القاعدتين ويعرض كل التفاصيل
 */
import { ECAS_DATABASES, mssqlPool } from './lib.mjs';

function decodeB64(s) {
  if (!s) return '—';
  try { return Buffer.from(String(s), 'base64').toString('utf8'); }
  catch { return '(خطأ فكّ)'; }
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 16).replace('T', ' '); }
  catch { return '—'; }
}

function statusLabel(s) {
  return s === 2 ? 'نشط' : s === 1 ? 'معطّل' : s === 0 ? 'محذوف' : `(${s})`;
}

async function main() {
  const allUsers = []; // { db, userNo, name, ... }

  for (const { code, label } of ECAS_DATABASES) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📦  قاعدة ${code} — ${label}`);
    console.log('═'.repeat(80));

    const mssql = await mssqlPool(code);
    try {
      const r = await mssql.request().query(`
        SELECT USER_NO, NAME, P, BRANCH_ID, LAST_LOGIN, STATUS, MOB_NO,
               ISMANAGER, SCODE, MOBSERL, ADD_DATE, ADJECTIVE
        FROM BILLING_MANAGERS_USERS
        ORDER BY USER_NO
      `);

      for (const u of r.recordset) {
        const row = {
          db: code,
          userNo: u.USER_NO,
          name: String(u.NAME ?? '').trim(),
          password: decodeB64(u.P),
          passwordRaw: u.P,
          branchId: u.BRANCH_ID,
          lastLogin: fmtDate(u.LAST_LOGIN),
          status: statusLabel(u.STATUS),
          mobile: u.MOB_NO,
          isManager: u.ISMANAGER ? 'نعم' : 'لا',
          scode: u.SCODE,
          addDate: fmtDate(u.ADD_DATE),
          adjective: u.ADJECTIVE,
        };
        allUsers.push(row);

        console.log(`\n  👤 USER_NO = ${row.userNo}`);
        console.log(`     الاسم              : ${row.name}`);
        console.log(`     كلمة السر (مفكوكة) : ${row.password}`);
        console.log(`     كلمة السر (ECAS)   : ${row.passwordRaw}`);
        console.log(`     الوصف              : ${row.adjective ?? '—'}`);
        console.log(`     مدير؟              : ${row.isManager}`);
        console.log(`     الحالة             : ${row.status}`);
        console.log(`     الفرع              : ${row.branchId}`);
        console.log(`     رقم الجوّال         : ${row.mobile || '—'}`);
        console.log(`     آخر دخول            : ${row.lastLogin}`);
        console.log(`     تاريخ الإنشاء       : ${row.addDate}`);
      }
    } finally {
      await mssql.close();
    }
  }

  // جدول ملخّص مُدمَج
  console.log(`\n${'═'.repeat(80)}`);
  console.log('📋  جدول مُلخَّص — جميع مستخدمي نظام الفوترة القديم');
  console.log('═'.repeat(80));
  console.log('');
  console.log('ECAS_DB  | USER_NO | الاسم                      | الوصف          | كلمة السر | آخر دخول');
  console.log('-'.repeat(110));
  for (const u of allUsers) {
    console.log(
      `${u.db}  | ${String(u.userNo).padStart(7)} | ${u.name.padEnd(24)} | ${(u.adjective ?? '').padEnd(13)} | ${u.password.padEnd(9)} | ${u.lastLogin}`,
    );
  }

  // إحصاءات
  const unique = new Set(allUsers.map((u) => u.name));
  console.log('');
  console.log(`📊 الإحصاءات:`);
  console.log(`   إجمالي السجلات عبر القاعدتين : ${allUsers.length}`);
  console.log(`   مستخدمون فريدون (حسب الاسم) : ${unique.size}`);
  console.log(`   Ecas2673 فقط                : ${allUsers.filter((u) => u.db === 'Ecas2673').length}`);
  console.log(`   Ecas2668 فقط                : ${allUsers.filter((u) => u.db === 'Ecas2668').length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
