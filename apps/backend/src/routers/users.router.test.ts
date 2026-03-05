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

import { usersRouter } from './users.router.js';
import { db } from '../db/index.js';
import { users, auditLog } from '../db/schema.js';
import bcrypt from 'bcryptjs';

type UserRow = typeof users.$inferSelect;

function adminCtx(user: UserRow) {
  return { req: {} as never, res: {} as never, user };
}

function viewerCtx(user: UserRow) {
  return { req: {} as never, res: {} as never, user };
}

async function createUser(username: string, role: 'admin' | 'viewer' = 'admin') {
  const hash = await bcrypt.hash('password123', 10);
  const [u] = await db
    .insert(users)
    .values({ username, passwordHash: hash, role })
    .returning();
  return u;
}

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(users);
});

describe('users.list', () => {
  it('returns users without passwordHash', async () => {
    const admin = await createUser('admin');
    const caller = usersRouter.createCaller(adminCtx(admin));
    const result = await caller.list();

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('admin');
    expect(result[0]).not.toHaveProperty('passwordHash');
  });
});

describe('users.create', () => {
  it('creates a user and returns without passwordHash', async () => {
    const admin = await createUser('admin');
    const caller = usersRouter.createCaller(adminCtx(admin));
    const result = await caller.create({ username: 'newuser', password: 'password123', role: 'viewer' });

    expect(result.username).toBe('newuser');
    expect(result.role).toBe('viewer');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws FORBIDDEN when called as viewer', async () => {
    const viewer = await createUser('viewer', 'viewer');
    const caller = usersRouter.createCaller(viewerCtx(viewer));
    await expect(
      caller.create({ username: 'other', password: 'password123', role: 'viewer' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws CONFLICT on duplicate username', async () => {
    const admin = await createUser('admin');
    const caller = usersRouter.createCaller(adminCtx(admin));
    await caller.create({ username: 'dupe', password: 'password123', role: 'viewer' });
    await expect(
      caller.create({ username: 'dupe', password: 'password123', role: 'viewer' })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('users.update', () => {
  it('changes the username', async () => {
    const admin = await createUser('admin');
    const [target] = await db
      .insert(users)
      .values({ username: 'oldname', passwordHash: 'hash', role: 'viewer' })
      .returning();
    const caller = usersRouter.createCaller(adminCtx(admin));
    const result = await caller.update({ id: target.id, username: 'newname' });
    expect(result.username).toBe('newname');
  });

  it('throws BAD_REQUEST when trying to change own role', async () => {
    const admin = await createUser('admin');
    const caller = usersRouter.createCaller(adminCtx(admin));
    await expect(
      caller.update({ id: admin.id, role: 'viewer' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('users.delete', () => {
  it('removes the user', async () => {
    const admin = await createUser('admin');
    const target = await createUser('todelete');
    const caller = usersRouter.createCaller(adminCtx(admin));
    const result = await caller.delete({ id: target.id });
    expect(result.success).toBe(true);

    const list = await caller.list();
    expect(list.find((u) => u.id === target.id)).toBeUndefined();
  });

  it('throws BAD_REQUEST when deleting self', async () => {
    const admin = await createUser('admin');
    const caller = usersRouter.createCaller(adminCtx(admin));
    await expect(caller.delete({ id: admin.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
