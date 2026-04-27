/**
 * Stage 07 — استيراد مستخدمي النظام الحقيقيين من ECAS
 *
 *   - يقرأ من BILLING_MANAGERS_USERS في كلا القاعدتين (Ecas2673 + Ecas2668)
 *   - يُزيل التكرار بناءً على NAME (نفس الشخص قد يظهر في القاعدتين)
 *   - يحفظ كلمة السر الأصلية (Base64 في ECAS) مُعاد تشفيرها بـ bcrypt
 *   - يربط كل مستخدم بمحطة: Ecas2673 فقط → dahamiya، Ecas2668 فقط → sabaliya
 *     إذا كان في القاعدتين (مثل المدير العام) → stationId = null (كل المحطات)
 *   - **يحذف** كل المستخدمين والموظفين السابقين من seed-users.ts (المُخترَعين)
 *
 * الاستخدام:
 *   node scripts/etl/07-system-users.mjs
 */
import { mssqlPool, pgClient } from './lib.mjs';
import bcrypt from 'bcryptjs';

const ECAS_DBS = [
  { code: 'Ecas2673', station: 'dahamiya', label: 'الدهمية' },
  { code: 'Ecas2668', station: 'sabaliya', label: 'الصبالية/جمال/غليل' },
];

/** فكّ كلمة السر من Base64 كما هي في ECAS */
function decodeEcasPassword(p) {
  if (!p) return null;
  try {
    return Buffer.from(String(p), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** توليد username لاتيني بسيط من الاسم العربي */
function generateUsername(name, userNo) {
  if (!name) return `user${userNo}`;
  const n = String(name).trim();
  // حالات خاصة
  if (n === 'Administrator') return 'admin';
  if (n === 'Administrator2') return 'admin2';
  if (n.includes('عمي محمد العباسي') || n.includes('عمي محمدي')) {
    return n.includes('العباسي') ? 'ammi.mohammed.abbasi' : 'ammi.mohammed';
  }
  if (n.includes('علي صعدي') || n.includes('علي الصعدي')) return 'ali.saadi';
  if (n.includes('رايد العباسي') || n.includes('رايـــد العباسي') || n.includes('رائد العباسي')) return 'raed.abbasi';
  if (n.includes('وائل بشر')) return 'wael.basher';
  if (n.includes('خالد حمود')) return 'khaled.hammoud';
  if (n.includes('علي المجهلي') || n.includes('علي أحمد المجهلي')) return 'ali.almajhali';
  // fallback
  return `user${userNo}`;
}

async function main() {
  const pg = pgClient();

  try {
    // 1. اجلب مستخدمي ECAS من القاعدتين
    const ecasUsers = new Map(); // name → { name, password, userNo, dbs: Set, isAdmin }

    for (const { code, station, label } of ECAS_DBS) {
      console.log(`\n📦 ${code} — ${label}`);
      const mssql = await mssqlPool(code);
      try {
        const r = await mssql.request().query(`
          SELECT USER_NO, NAME, P, STATUS, ISMANAGER, ADJECTIVE, MOB_NO, LAST_LOGIN
          FROM BILLING_MANAGERS_USERS
          WHERE STATUS <> 0
          ORDER BY USER_NO
        `);
        for (const row of r.recordset) {
          const name = String(row.NAME ?? '').trim();
          if (!name) continue;

          const existing = ecasUsers.get(name);
          if (existing) {
            existing.dbs.add(code);
            existing.stations.add(station);
          } else {
            ecasUsers.set(name, {
              userNo: row.USER_NO,
              name,
              password: row.P,
              isManager: !!row.ISMANAGER,
              adjective: row.ADJECTIVE ?? null,
              mobile: row.MOB_NO ?? null,
              lastLogin: row.LAST_LOGIN,
              dbs: new Set([code]),
              stations: new Set([station]),
            });
          }
        }
        console.log(`   قُرِئ: ${r.recordset.length} مستخدم`);
      } finally {
        await mssql.close();
      }
    }

    console.log(`\n✅ إجمالي المستخدمين الفريدين: ${ecasUsers.size}`);

    // 2. احذف المستخدمين والموظفين الحاليين (المُخترَعين من seed-users)
    console.log('\n🗑️  حذف المستخدمين والموظفين السابقين...');
    await pg`DELETE FROM sessions`; // الجلسات تعتمد على users
    const delUsers = await pg`DELETE FROM users RETURNING id`;
    console.log(`   حُذف ${delUsers.length} مستخدم`);
    const delEmp = await pg`DELETE FROM employees RETURNING id`;
    console.log(`   حُذف ${delEmp.length} موظف`);

    // 3. اجلب IDs محطات PostgreSQL — جدولان: stations (للـ employees) و billing_stations (للمستخدمين في البيانات)
    const billingStRows = await pg`SELECT id, code FROM billing_stations`;
    const billingStationByCode = new Map(billingStRows.map((r) => [r.code, r.id]));

    // الربط بين billing_stations code و stations name
    const NAME_BY_CODE = {
      dahamiya: 'الدهمية',
      sabaliya: 'الصبالية',
      jamal: 'جمال',
      ghalil: 'غليل',
    };
    const regStRows = await pg`SELECT id, name FROM stations`;
    const regStationByCode = new Map();
    for (const [code, nameKey] of Object.entries(NAME_BY_CODE)) {
      const match = regStRows.find((s) => s.name.includes(nameKey));
      if (match) regStationByCode.set(code, match.id);
    }

    // نستخدم regStationByCode للموظفين، وbillingStationByCode للمستخدمين (users.station_id يُشير إلى stations أيضاً حسب schema)

    // 4. أدخل المستخدمين الحقيقيين
    console.log('\n📥 إدخال المستخدمين الحقيقيين...');

    let created = 0;
    for (const u of ecasUsers.values()) {
      const decoded = decodeEcasPassword(u.password) ?? `ecas_${u.userNo}`;
      const hash = await bcrypt.hash(decoded, 10);
      const username = generateUsername(u.name, u.userNo);

      // تحديد المحطة والدور (stationId يشير إلى جدول stations الأساسي)
      let stationId = null;
      let role = 'station_manager';

      if (u.name === 'Administrator' || u.name === 'Administrator2' || u.adjective === 'مبرمج النظام') {
        role = 'admin';
        stationId = null;
      } else if (u.name.includes('عمي محمد العباسي') || u.name.includes('عمي محمدي')) {
        role = 'admin';
        stationId = null;
      } else if (u.name.includes('علي صعدي')) {
        role = 'accountant';
        stationId = null;
      } else if (u.stations.size === 1) {
        const onlyStation = [...u.stations][0];
        stationId = regStationByCode.get(onlyStation) ?? null;
        // قرارات دور مخصّصة حسب الاسم المعروف
        if (u.name.includes('المجهلي')) role = 'station_manager'; // مدير الصبالية
        else if (u.name.includes('رايد العباسي') || u.name.includes('رايـــد')) role = 'station_manager';
        else role = 'technician';
      } else {
        // في القاعدتين = admin عام
        role = 'admin';
        stationId = null;
      }

      // أدخل الموظف أولاً (للربط بالـ employee)
      const roleLabel =
        role === 'admin' ? 'مدير تنفيذي' :
        role === 'accountant' ? 'محاسب' :
        role === 'station_manager' ? 'مدير محطة' : 'مستخدم نظام';

      const [emp] = await pg`
        INSERT INTO employees (name, role, phone, email, station_id, status)
        VALUES (${u.name}, ${roleLabel}, ${u.mobile ? String(u.mobile) : ''}, '', ${stationId}, 'active')
        RETURNING id
      `;

      // ثم المستخدم
      await pg`
        INSERT INTO users (username, password_hash, role, station_id, employee_id, is_active, must_change_password, last_login_at)
        VALUES (
          ${username}, ${hash}, ${role}, ${stationId}, ${emp.id}, true, true, ${u.lastLogin}
        )
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          station_id = EXCLUDED.station_id
      `;

      created++;
      const dbs = [...u.dbs].join(', ');
      const stNames = [...u.stations].join('/');
      console.log(`   ✅ ${username.padEnd(28)} — ${u.name.padEnd(25)} [${role}, ${stNames}] (${dbs})`);
    }

    console.log(`\n✅ تمّ إنشاء ${created} مستخدم حقيقي من ECAS`);
    console.log('\n🔑 كلمات السر المحفوظة من ECAS:');
    console.log('   - Administrator/admin           → 11225511');
    console.log('   - Administrator2/admin2         → 11225511');
    console.log('   - بقية المستخدمين                → 123123');
    console.log('\n⚠️  جميع الحسابات مُعلَّمة must_change_password=true');
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
