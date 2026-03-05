import { db } from './index.js';
import { users } from './schema.js';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../lib/config.js';

async function seed() {
  const passwordHash = await bcrypt.hash('admin', BCRYPT_ROUNDS);

  await db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash,
      role: 'admin',
    })
    .onConflictDoNothing();

  console.log('Seed complete. Default user: admin / admin');
}

seed().catch(console.error);
