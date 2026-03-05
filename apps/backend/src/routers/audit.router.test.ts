import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db/index.js', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../db/schema.js');
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE "users" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "username" text NOT NULL,
      "password_hash" text NOT NULL,
      "role" text DEFAULT 'admin' NOT NULL,
      "oidc_subject" text,
      "oidc_issuer" text,
      "created_at" integer DEFAULT (unixepoch()) NOT NULL
    );
    CREATE UNIQUE INDEX "users_username_unique" ON "users" ("username");
    CREATE TABLE "audit_log" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "user_id" integer,
      "username" text NOT NULL,
      "action" text NOT NULL,
      "entity_type" text NOT NULL,
      "entity_id" text,
      "payload_before" text,
      "payload_after" text,
      "created_at" integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
    );
  `);
  return { db: drizzle(sqlite, { schema }) };
});

import { auditRouter } from './audit.router.js';
import { db } from '../db/index.js';
import { users, auditLog } from '../db/schema.js';

type UserRow = typeof users.$inferSelect;

function makeCtx(user: UserRow) {
  return { req: {} as never, res: {} as never, user };
}

let adminUser: UserRow;

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(users);

  const [u] = await db
    .insert(users)
    .values({ username: 'admin', passwordHash: 'hash', role: 'admin' })
    .returning();
  adminUser = u;
});

async function insertLog(action: string, entityType: string, entityId?: string) {
  await db.insert(auditLog).values({
    userId: adminUser.id,
    username: adminUser.username,
    action,
    entityType,
    entityId: entityId ?? null,
  });
}

describe('audit.list', () => {
  it('returns paginated results', async () => {
    for (let i = 0; i < 5; i++) {
      await insertLog(`ACTION_${i}`, 'zone', `zone-${i}`);
    }

    const caller = auditRouter.createCaller(makeCtx(adminUser));
    const result = await caller.list({ page: 1, limit: 3 });

    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(3);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
  });

  it('returns second page correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await insertLog(`ACTION_${i}`, 'zone', `zone-${i}`);
    }

    const caller = auditRouter.createCaller(makeCtx(adminUser));
    const result = await caller.list({ page: 2, limit: 3 });

    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(2);
  });

  it('filters by entityType', async () => {
    await insertLog('CREATE_ZONE', 'zone', 'example.com.');
    await insertLog('CREATE_FORWARDER', 'forwarder', 'internal.');
    await insertLog('DELETE_ZONE', 'zone', 'old.com.');

    const caller = auditRouter.createCaller(makeCtx(adminUser));
    const result = await caller.list({ page: 1, limit: 20, entityType: 'zone' });

    expect(result.total).toBe(2);
    expect(result.items.every((e) => e.entityType === 'zone')).toBe(true);
  });

  it('returns all entries when no entityType filter', async () => {
    await insertLog('CREATE_ZONE', 'zone');
    await insertLog('FLUSH_CACHE', 'cache');

    const caller = auditRouter.createCaller(makeCtx(adminUser));
    const result = await caller.list({ page: 1, limit: 20 });

    expect(result.total).toBe(2);
  });
});
