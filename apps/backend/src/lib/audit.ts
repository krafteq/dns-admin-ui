import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import type { User } from '../db/schema.js';

interface AuditOptions {
  user: User;
  action: string;
  entityType: string;
  entityId?: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
}

export async function writeAuditLog(opts: AuditOptions) {
  await db.insert(auditLog).values({
    userId: opts.user.id,
    username: opts.user.username,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId ?? null,
    payloadBefore: opts.payloadBefore != null ? JSON.stringify(opts.payloadBefore) : null,
    payloadAfter: opts.payloadAfter != null ? JSON.stringify(opts.payloadAfter) : null,
  });
}
