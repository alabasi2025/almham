import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Failed to record audit entry:', err);
  }
}
