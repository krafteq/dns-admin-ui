import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { BCRYPT_ROUNDS } from '../lib/config.js';
import { CreateUserInputSchema, UpdateUserInputSchema } from '@dns-admin/shared';

export const usersRouter = router({
  list: protectedProcedure.query(async () => {
    return db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        oidcIssuer: users.oidcIssuer,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.username));
  }),

  create: adminProcedure
    .input(CreateUserInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        const [user] = await db
          .insert(users)
          .values({ username: input.username, passwordHash, role: input.role })
          .returning({
            id: users.id,
            username: users.username,
            role: users.role,
            createdAt: users.createdAt,
          });
        await writeAuditLog({
          user: ctx.user,
          action: 'CREATE_USER',
          entityType: 'user',
          entityId: input.username,
          payloadAfter: { username: input.username, role: input.role },
        });
        return user;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('UNIQUE constraint failed')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' });
        }
        console.error('[Create user]', e);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
      }
    }),

  update: adminProcedure
    .input(UpdateUserInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id && input.role && input.role !== ctx.user.role) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change your own role' });
      }
      const updates: Record<string, unknown> = {};
      if (input.username) updates.username = input.username;
      if (input.password) updates.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      if (input.role) updates.role = input.role;

      const [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, input.id))
        .returning({
          id: users.id,
          username: users.username,
          role: users.role,
          createdAt: users.createdAt,
        });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      await writeAuditLog({
        user: ctx.user,
        action: 'UPDATE_USER',
        entityType: 'user',
        entityId: String(input.id),
        payloadAfter: { username: input.username, role: input.role },
      });
      return user;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete yourself' });
      }
      const [target] = await db.select().from(users).where(eq(users.id, input.id));
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      await db.delete(users).where(eq(users.id, input.id));
      await writeAuditLog({
        user: ctx.user,
        action: 'DELETE_USER',
        entityType: 'user',
        entityId: target.username,
      });
      return { success: true };
    }),
});
