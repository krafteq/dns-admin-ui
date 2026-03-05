import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
console.log('Migrations applied successfully.');
