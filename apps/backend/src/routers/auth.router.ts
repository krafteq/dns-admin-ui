import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { JWT_SECRET, BCRYPT_ROUNDS } from '../lib/config.js';
import { writeAuditLog } from '../lib/audit.js';
import { isOidcEnabled } from '../lib/oidc.js';

// Dummy hash used to prevent timing attacks when the username doesn't exist.
// We compare against this so that bcrypt always runs regardless of user lookup result.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-timing-safe', BCRYPT_ROUNDS);

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username));

      // Always run bcrypt.compare to prevent timing-based username enumeration
      const valid = await bcrypt.compare(
        input.password,
        user?.passwordHash ?? DUMMY_HASH
      );

      if (!user || !valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const token = await new SignJWT({ sub: String(user.id), role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(JWT_SECRET);

      ctx.res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 1000, // 1 day in ms
        secure: process.env.NODE_ENV === 'production',
      });

      await writeAuditLog({
        user,
        action: 'LOGIN',
        entityType: 'auth',
        entityId: user.username,
      });

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        isOidc: false,
      };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { success: true };
  }),

  oidcEnabled: publicProcedure.query(() => ({ enabled: isOidcEnabled() })),

  me: protectedProcedure.query(({ ctx }) => {
    const u = ctx.user;
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      isOidc: !!u.oidcSubject,
    };
  }),
});
