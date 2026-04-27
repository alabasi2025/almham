import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema-billing.js';

const connectionString = process.env['BILLING_DATABASE_URL'] ?? process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('BILLING_DATABASE_URL مطلوب لتشغيل نظام الفوترة Web');
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export async function closeDb() {
  await client.end();
}
