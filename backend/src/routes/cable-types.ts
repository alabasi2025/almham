import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '../db/index.js';
import { cableTypes } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGlobalAccess } from '../lib/access-control.js';
import { recordAudit } from '../lib/audit.js';
import type { HonoEnv } from '../lib/hono-env.js';

const app = new Hono<HonoEnv>();

app.use('*', requireAuth);

const cableTypeSchema = z.object({
  name: z.string().min(1).max(128),
  sizeMm: z.number().positive().nullable().optional(),
  material: z.string().max(64).nullable().optional(),
  phaseConfig: z.enum(['single_phase_earth', 'two_phase_earth', 'three_phase_earth', 'earth_only', 'other']).optional(),
  earthMode: z.enum(['insulated', 'bare', 'none']).optional(),
  maxAmps: z.number().int().positive().nullable().optional(),
  color: z.string().max(7).regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().nullable().optional(),
});

// GET /cable-types — list all active cable types
app.get('/', async (c) => {
  const showAll = c.req.query('all') === 'true';
  const rows = await db
    .select()
    .from(cableTypes)
    .where(showAll ? undefined : eq(cableTypes.isActive, true))
    .orderBy(cableTypes.name);
  return c.json(rows);
});

// POST /cable-types — create (admin only)
app.post('/', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const parsed = cableTypeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'بيانات غير صحيحة', details: parsed.error.issues }, 400);
  const data = parsed.data;

  const [created] = await db.insert(cableTypes).values({
    name: data.name,
    sizeMm: data.sizeMm?.toString() ?? null,
    material: data.material ?? null,
    phaseConfig: data.phaseConfig ?? 'single_phase_earth',
    earthMode: data.earthMode ?? 'insulated',
    maxAmps: data.maxAmps ?? null,
    color: data.color ?? '#6b7280',
    description: data.description ?? null,
  }).returning();

  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'cable_type_create',
    entityType: 'cable_types',
    entityId: created.id,
    metadata: data,
  });
  return c.json(created, 201);
});

// PUT /cable-types/:id — update
app.put('/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  const [current] = await db.select().from(cableTypes).where(eq(cableTypes.id, id)).limit(1);
  if (!current) return c.json({ error: 'نوع الكابل غير موجود' }, 404);

  const body = await c.req.json();
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.sizeMm !== undefined) updateData.sizeMm = body.sizeMm?.toString() ?? null;
  if (body.material !== undefined) updateData.material = body.material;
  if (body.phaseConfig !== undefined) updateData.phaseConfig = body.phaseConfig;
  if (body.earthMode !== undefined) updateData.earthMode = body.earthMode;
  if (body.maxAmps !== undefined) updateData.maxAmps = body.maxAmps;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const [updated] = await db.update(cableTypes).set(updateData).where(eq(cableTypes.id, id)).returning();
  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'cable_type_update',
    entityType: 'cable_types',
    entityId: id,
    metadata: updateData,
  });
  return c.json(updated);
});

// DELETE /cable-types/:id — soft delete (set is_active = false)
app.delete('/:id', async (c) => {
  const denied = requireGlobalAccess(c);
  if (denied) return denied;

  const id = c.req.param('id');
  const [current] = await db.select().from(cableTypes).where(eq(cableTypes.id, id)).limit(1);
  if (!current) return c.json({ error: 'نوع الكابل غير موجود' }, 404);

  const [updated] = await db.update(cableTypes).set({ isActive: false }).where(eq(cableTypes.id, id)).returning();
  await recordAudit({
    userId: c.get('auth').user.id,
    action: 'cable_type_delete',
    entityType: 'cable_types',
    entityId: id,
    metadata: { name: current.name },
  });
  return c.json(updated);
});

export default app;
