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
}));

app.get('/', (c) => {
  return c.json({
    message: 'مرحباً بك في API العباسي للأنظمة الذكية - نظام إدارة محطات الكهرباء',
    version: '1.0.0',
    endpoints: {
      stations: '/api/stations',
      employees: '/api/employees',
      tasks: '/api/tasks',
    },
  });
});

app.route('/api/stations', stationsRoute);
app.route('/api/employees', employeesRoute);
app.route('/api/tasks', tasksRoute);
app.route('/api/reset', resetRoute);
app.route('/api/fuel', fuelRoute);

const port = Number(process.env['PORT']) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 السيرفر شغال على http://localhost:${info.port}`);
});
