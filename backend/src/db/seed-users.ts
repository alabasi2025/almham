import 'dotenv/config';
import { eq } from 'drizzle-orm';
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

const RESET_PASSWORDS = process.env['SEED_RESET_USER_PASSWORDS'] === 'true';
const SEED_PASSWORD = process.env['SEED_DEFAULT_USER_PASSWORD'];

const PEOPLE: Person[] = [
  { name: 'محمد العباسي', role: 'admin', username: 'admin' },
];

const OFFICIAL_USERNAMES = new Set(PEOPLE.map((person) => person.username));

async function findStationIdByKey(key: string): Promise<string | null> {
  const rows = await db.select().from(stations);
  const match = rows.find((s) => s.name.includes(key));
  return match?.id ?? null;
}

async function upsertEmployee(
  name: string,
  role: Role,
  stationId: string | null,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.select().from(employees).where(eq(employees.name, name)).limit(1);
  if (existing[0]) {
    await db
      .update(employees)
      .set({
        role: roleLabel(role),
        stationId,
        status: 'active',
      })
      .where(eq(employees.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  const [row] = await db
    .insert(employees)
    .values({
      name,
      role: roleLabel(role),
      phone: '',
      email: '',
      stationId,
      status: 'active',
    })
    .returning();
  return { id: row.id, created: true };
}

async function upsertUser(
  username: string,
  employeeId: string,
  role: Role,
  stationId: string | null,
  passwordHashForNewUser: string,
): Promise<'created' | 'updated'> {
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing[0]) {
    const shouldResetPassword = RESET_PASSWORDS && SEED_PASSWORD;
    await db
      .update(users)
      .set({
        employeeId,
        role,
        stationId,
        isActive: true,
        ...(shouldResetPassword
          ? { passwordHash: await hashPassword(SEED_PASSWORD), mustChangePassword: true }
          : {}),
      })
      .where(eq(users.id, existing[0].id));
    return 'updated';
  }
  await db.insert(users).values({
    username,
    employeeId,
    role,
    stationId,
    passwordHash: passwordHashForNewUser,
    isActive: true,
    mustChangePassword: true,
  });
  return 'created';
}

function roleLabel(role: Role): string {
  if (role === 'admin') return 'مدير تنفيذي';
  if (role === 'accountant') return 'محاسب';
  if (role === 'station_manager') return 'مدير محطة';
  return 'فنّي';
}

async function resolvePasswordHashForNewUsers(): Promise<string> {
  if (SEED_PASSWORD) {
    if (SEED_PASSWORD.length < 8) {
      throw new Error('SEED_DEFAULT_USER_PASSWORD يجب أن تكون 8 أحرف على الأقل');
    }
    return hashPassword(SEED_PASSWORD);
  }

  const [adminUser] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);

  if (adminUser) {
    console.log('🔐 لا توجد كلمة مرور seed في البيئة؛ سيتم استخدام كلمة مرور admin الحالية للحسابات الجديدة.');
    return adminUser.passwordHash;
  }

  throw new Error('ضع SEED_DEFAULT_USER_PASSWORD في البيئة لإنشاء أول مستخدمين للنظام');
}

async function deleteNonOfficialUsers(): Promise<number> {
  const allUsers = await db.select({ id: users.id, username: users.username, isActive: users.isActive }).from(users);
  let deleted = 0;

  for (const user of allUsers) {
    if (!OFFICIAL_USERNAMES.has(user.username)) {
      await db.delete(users).where(eq(users.id, user.id));
      deleted++;
      console.log(`🗑️  حذف حساب مستخدم: ${user.username}`);
    }
  }

  return deleted;
}

async function main() {
  console.log('🌱 مزامنة حساب مدير النظام فقط...');
  console.log('');

  const passwordHashForNewUsers = await resolvePasswordHashForNewUsers();
  let createdEmployees = 0;
  let updatedEmployees = 0;
  let createdUsers = 0;
  let updatedUsers = 0;

  for (const person of PEOPLE) {
    const stationId = person.station ? await findStationIdByKey(person.station) : null;
    if (person.station && !stationId) {
      console.warn(`⚠️  محطة "${person.station}" غير موجودة — تخطّي ${person.name}`);
      continue;
    }

    const employee = await upsertEmployee(person.name, person.role, stationId);
    if (employee.created) createdEmployees++;
    else updatedEmployees++;

    const userStatus = await upsertUser(person.username, employee.id, person.role, stationId, passwordHashForNewUsers);
    if (userStatus === 'created') {
      createdUsers++;
      console.log(`✅ ${person.username.padEnd(25)} — ${person.name} (${person.role}${person.station ? ', ' + person.station : ''})`);
    } else {
      updatedUsers++;
      console.log(`🔄 ${person.username.padEnd(25)} — تحديث الربط والصلاحية`);
    }
  }

  const deletedUsers = await deleteNonOfficialUsers();

  console.log('');
  console.log(`📊 موظفون جدد: ${createdEmployees}`);
  console.log(`📊 موظفون تم تحديثهم: ${updatedEmployees}`);
  console.log(`👤 حسابات جديدة: ${createdUsers}`);
  console.log(`👤 حسابات تم تحديثها: ${updatedUsers}`);
  console.log(`🗑️  حسابات مستخدمين تم حذفها: ${deletedUsers}`);
  console.log('');
  console.log('✅ شاشة الدخول ستعرض مدير النظام فقط.');
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
