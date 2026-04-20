import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { users } from './schema.js';
import { hashPassword } from '../lib/password.js';

const USERNAME = process.argv[2] ?? 'admin';
const NEW_PASSWORD = process.argv[3] ?? '1';

async function main() {
  const hash = await hashPassword(NEW_PASSWORD);
  const [updated] = await db
    .update(users)
    .set({ passwordHash: hash, mustChangePassword: false })
    .where(eq(users.username, USERNAME))
    .returning({ id: users.id, username: users.username });

  if (!updated) {
    console.error(`❌ المستخدم "${USERNAME}" غير موجود`);
    process.exit(1);
  }

  console.log(`✅ تم تغيير كلمة سر "${updated.username}" إلى: "${NEW_PASSWORD}"`);
  console.log(`   mustChangePassword = false`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
