import type { Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '../lib/config.js';

export async function createContext({ req, res }: { req: Request; res: Response }) {
  let user = null;

  const token = req.cookies?.token as string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = payload.sub ? parseInt(payload.sub, 10) : null;
      if (userId) {
        const [found] = await db.select().from(users).where(eq(users.id, userId));
        user = found ?? null;
      }
    } catch {
      // Invalid token — treat as unauthenticated
    }
  }

  return { req, res, user };
}
