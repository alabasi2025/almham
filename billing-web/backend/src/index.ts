import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import billingRoute from './routes/billing.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      return allowed ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.get('/', (c) =>
  c.json({
    message: 'نظام الفوترة Web — API',
    version: '0.1.0',
    endpoints: {
      billing: '/api/billing',
    },
  }),
);

app.route('/api/billing', billingRoute);

const port = Number(process.env['BILLING_PORT']) || 3100;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`نظام الفوترة Web يعمل على http://localhost:${info.port}`);
});
