import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbUrl = process.env.DATABASE_URL ?? './data/dns-admin.db';

// Ensure the data directory exists
try {
  mkdirSync(dirname(dbUrl), { recursive: true });
} catch {
  // already exists
}

const sqlite = new Database(dbUrl);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
