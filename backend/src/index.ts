import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import stationsRoute from './routes/stations.js';
import employeesRoute from './routes/employees.js';
import tasksRoute from './routes/tasks.js';
import resetRoute from './routes/reset.js';
import fuelRoute from './routes/fuel.js';
import authRoute from './routes/auth.js';
import usersRoute from './routes/users.js';
import treasuryRoute from './routes/treasury.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin;

    const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    return allowed ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));

app.get('/', (c) => {
  return c.json({
    message: 'أنظمة العباسي المتخصصة — API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      stations: '/api/stations',
      employees: '/api/employees',
      tasks: '/api/tasks',
      fuel: '/api/fuel',
    },
  });
});

app.route('/api/auth', authRoute);
app.route('/api/treasury', treasuryRoute);
app.route('/api/users', usersRoute);
app.route('/api/stations', stationsRoute);
app.route('/api/employees', employeesRoute);
app.route('/api/tasks', tasksRoute);
app.route('/api/reset', resetRoute);
app.route('/api/fuel', fuelRoute);

const port = Number(process.env['PORT']) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 السيرفر شغال على http://localhost:${info.port}`);
});
