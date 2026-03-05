import { z } from 'zod';
import { desc, eq, count } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        entityType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, entityType } = input;
      const offset = (page - 1) * limit;

      const whereClause = entityType ? eq(auditLog.entityType, entityType) : undefined;

      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(auditLog)
          .where(whereClause)
          .orderBy(desc(auditLog.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(auditLog)
          .where(whereClause),
      ]);

      return {
        items: rows.map((r) => ({
          ...r,
          payloadBefore: r.payloadBefore ? JSON.parse(r.payloadBefore) : null,
          payloadAfter: r.payloadAfter ? JSON.parse(r.payloadAfter) : null,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),
});
