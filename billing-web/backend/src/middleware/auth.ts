import type { Context, Next } from 'hono';

export async function requireAuth(c: Context, next: Next) {
  if (process.env['BILLING_DEV_AUTH_DISABLED'] === 'true') {
    await next();
    return;
  }

  const expectedToken = process.env['BILLING_API_TOKEN'];
  if (!expectedToken) {
    return c.json({ error: 'لم يتم إعداد حماية نظام الفوترة Web' }, 503);
  }

  const authorization = c.req.header('authorization');
  if (authorization !== `Bearer ${expectedToken}`) {
    return c.json({ error: 'يجب تسجيل الدخول إلى نظام الفوترة' }, 401);
  }

  await next();
}
