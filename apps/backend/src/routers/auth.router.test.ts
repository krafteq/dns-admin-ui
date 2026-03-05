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

import bcrypt from 'bcryptjs';
import { authRouter } from './auth.router.js';
import { db } from '../db/index.js';
import { users, auditLog } from '../db/schema.js';

function makeCtx(user = null as (typeof users.$inferSelect) | null) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  return {
    req: {} as never,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res: res as any,
    user,
    _resMock: res,
  };
}

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(users);
});

describe('auth.login', () => {
  it('returns user and sets cookie on valid credentials', async () => {
    const hash = await bcrypt.hash('admin', 10);
    await db.insert(users).values({ username: 'admin', passwordHash: hash, role: 'admin' });

    const ctx = makeCtx();
    const caller = authRouter.createCaller(ctx);
    const result = await caller.login({ username: 'admin', password: 'admin' });

    expect(result.username).toBe('admin');
    expect(result.role).toBe('admin');
    expect(ctx._resMock.cookie).toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED on wrong password', async () => {
    const hash = await bcrypt.hash('admin', 10);
    await db.insert(users).values({ username: 'admin', passwordHash: hash, role: 'admin' });

    const caller = authRouter.createCaller(makeCtx());
    await expect(caller.login({ username: 'admin', password: 'wrong' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws UNAUTHORIZED on unknown user', async () => {
    const caller = authRouter.createCaller(makeCtx());
    await expect(caller.login({ username: 'nobody', password: 'pass' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('auth.me', () => {
  it('returns user when authenticated', async () => {
    const hash = await bcrypt.hash('pw', 10);
    const [u] = await db
      .insert(users)
      .values({ username: 'admin', passwordHash: hash, role: 'admin' })
      .returning();
    const caller = authRouter.createCaller(makeCtx(u));
    const result = await caller.me();
    expect(result.username).toBe('admin');
    expect(result.isOidc).toBe(false);
  });

  it('returns isOidc true for OIDC user', async () => {
    const [u] = await db
      .insert(users)
      .values({
        username: 'sso-user',
        passwordHash: '',
        role: 'viewer',
        oidcSubject: 'sub-123',
        oidcIssuer: 'https://idp.example.com',
      })
      .returning();
    const caller = authRouter.createCaller(makeCtx(u));
    const result = await caller.me();
    expect(result.username).toBe('sso-user');
    expect(result.isOidc).toBe(true);
  });

  it('throws UNAUTHORIZED when not authenticated', async () => {
    const caller = authRouter.createCaller(makeCtx(null));
    await expect(caller.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
