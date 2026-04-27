import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema-billing.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['BILLING_DATABASE_URL'] ?? process.env['DATABASE_URL']!,
  },
});
