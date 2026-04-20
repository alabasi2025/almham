import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from './index.js';
import { stations, employees, users } from './schema.js';
import { hashPassword } from '../lib/password.js';

type Role = 'admin' | 'accountant' | 'station_manager' | 'technician';

interface Person {
  name: string;
  role: Role;
  station?: 'الصبالية' | 'الدهمية' | 'جمال' | 'غليل';
  username: string;
  phone?: string;
}

const DEFAULT_PASSWORD = 'almham2026';

const PEOPLE: Person[] = [
  // الإدارة العليا
  { name: 'محمد العباسي', role: 'admin', username: 'admin' },
  { name: 'علي محمد الصعدي', role: 'accountant', username: 'ali.saadi' },

  // مدراء المحطات
  { name: 'علي أحمد المجهلي', role: 'station_manager', station: 'الصبالية', username: 'ali.almajhali' },
  { name: 'رائد العباسي', role: 'station_manager', station: 'الدهمية', username: 'raed.abbasi' },
  { name: 'قايد حسين العباسي', role: 'station_manager', station: 'جمال', username: 'qaid.hussein' },
  { name: 'قايد حسن العباسي', role: 'station_manager', station: 'غليل', username: 'qaid.hassan' },

  // فنّيو الصبالية
  { name: 'محمد إبراهيم', role: 'technician', station: 'الصبالية', username: 'mohammed.ibrahim' },
  { name: 'خالد أبو الرجال', role: 'technician', station: 'الصبالية', username: 'khaled.rijal' },
  { name: 'محمد صغير', role: 'technician', station: 'الصبالية', username: 'mohammed.saghir' },

  // فنّيو الدهمية
  { name: 'إبراهيم فارع', role: 'technician', station: 'الدهمية', username: 'ibrahim.farea' },
  { name: 'سلطان الريمي', role: 'technician', station: 'الدهمية', username: 'sultan.rimi' },
  { name: 'حسن فهد', role: 'technician', station: 'الدهمية', username: 'hassan.fahd' },
  { name: 'محمد عبدالله بقشة', role: 'technician', station: 'الدهمية', username: 'mohammed.baqsha' },
  { name: 'علاء الصعدي', role: 'technician', station: 'الدهمية', username: 'alaa.saadi' },

  // فنّيو جمال
  { name: 'عبدالخالف المزعقي', role: 'technician', station: 'جمال', username: 'abdulkhalef.mazaqi' },
  { name: 'وائل بشر', role: 'technician', station: 'جمال', username: 'wael.basher' },

  // فنّيو غليل
  { name: 'معين العباسي', role: 'technician', station: 'غليل', username: 'moin.abbasi' },
  { name: 'مهند العباسي', role: 'technician', station: 'غليل', username: 'muhannad.abbasi' },
  { name: 'أحمد المغربي', role: 'technician', station: 'غليل', username: 'ahmad.maghrabi' },
  { name: 'مراد جريب', role: 'technician', station: 'غليل', username: 'murad.jarib' },
  { name: 'سامي الحرازي', role: 'technician', station: 'غليل', username: 'sami.harazi' },
];

async function findStationIdByKey(key: string): Promise<string | null> {
  const rows = await db.select().from(stations);
  const match = rows.find((s) => s.name.includes(key));
  return match?.id ?? null;
}

async function upsertEmployee(
  name: string,
  role: Role,
  stationId: string | null,
): Promise<string> {
  const existing = await db.select().from(employees).where(eq(employees.name, name)).limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  const roleLabel =
    role === 'admin'
      ? 'مدير تنفيذي'
      : role === 'accountant'
      ? 'محاسب'
      : role === 'station_manager'
      ? 'مدير محطة'
      : 'فنّي';

  const [row] = await db
    .insert(employees)
    .values({
      name,
      role: roleLabel,
      phone: '',
      email: '',
      stationId,
      status: 'active',
    })
    .returning();
  return row.id;
}

async function upsertUser(
  username: string,
  employeeId: string,
  role: Role,
  stationId: string | null,
  passwordHash: string,
): Promise<boolean> {
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing[0]) {
    return false;
  }
  await db.insert(users).values({
    username,
    employeeId,
    role,
    stationId,
    passwordHash,
    isActive: true,
    mustChangePassword: true,
  });
  return true;
}

async function main() {
  console.log('🌱 زرع الموظفين والمستخدمين...');
  console.log('');

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  let createdEmployees = 0;
  let createdUsers = 0;

  for (const person of PEOPLE) {
    const stationId = person.station ? await findStationIdByKey(person.station) : null;
    if (person.station && !stationId) {
      console.warn(`⚠️  محطة "${person.station}" غير موجودة — تخطّي ${person.name}`);
      continue;
    }

    const employeeId = await upsertEmployee(person.name, person.role, stationId);
    const empExisted = (await db.select().from(employees).where(eq(employees.id, employeeId))).length > 0;
    if (empExisted) {
      // check was it freshly created this run — heuristic: count before
    }
    createdEmployees++;

    const userCreated = await upsertUser(person.username, employeeId, person.role, stationId, passwordHash);
    if (userCreated) {
      createdUsers++;
      console.log(`✅ ${person.username.padEnd(25)} — ${person.name} (${person.role}${person.station ? ', ' + person.station : ''})`);
    } else {
      console.log(`➖ ${person.username.padEnd(25)} — موجود مسبقاً`);
    }
  }

  console.log('');
  console.log(`📊 موظفون تمّ التحقّق منهم: ${createdEmployees}`);
  console.log(`👤 حسابات جديدة: ${createdUsers}`);
  console.log('');
  console.log('🔑 كلمة السر الافتراضية للجميع: ' + DEFAULT_PASSWORD);
  console.log('⚠️  يجب على كل مستخدم تغييرها عند أول تسجيل دخول.');
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
