import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { recursorClient } from '../services/recursor.client.js';
import { writeAuditLog } from '../lib/audit.js';
import { throwSanitizedError } from '../lib/errors.js';
import { CreateForwardZoneInputSchema, UpdateForwardZoneInputSchema, SetAllowFromInputSchema, SetAllowNotifyFromInputSchema } from '@dns-admin/shared';

export const recursorRouter = router({
  serverInfo: protectedProcedure.query(async () => {
    try {
      return await recursorClient.getServerInfo();
    } catch (e) {
      throwSanitizedError('Fetch recursor info', e);
    }
  }),

  stats: protectedProcedure.query(async () => {
    try {
      return await recursorClient.getStats();
    } catch (e) {
      throwSanitizedError('Fetch recursor stats', e);
    }
  }),

  rpzStats: protectedProcedure.query(async () => {
    try {
      return await recursorClient.getRpzStatistics();
    } catch (e) {
      throwSanitizedError('Fetch RPZ statistics', e);
    }
  }),

  cache: router({
    stats: protectedProcedure.query(async () => {
      try {
        return await recursorClient.getCacheStats();
      } catch (e) {
        throwSanitizedError('Fetch cache stats', e);
      }
    }),

    flush: adminProcedure
      .input(z.object({ name: z.string().optional(), subtree: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await recursorClient.flushCache(input.name, input.subtree);
          await writeAuditLog({
            user: ctx.user,
            action: 'FLUSH_RECURSOR_CACHE',
            entityType: 'cache',
            entityId: input.name ?? '*',
          });
          return result;
        } catch (e) {
          throwSanitizedError('Flush recursor cache', e);
        }
      }),
  }),

  forwarders: router({
    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(200).default(50),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        try {
          const all = await recursorClient.listForwarders() as Array<{
            id: string; name: string; kind: string; servers?: string[];
          }>;
          const page = input?.page ?? 1;
          const limit = input?.limit ?? 50;
          const search = input?.search;
          const filtered = search
            ? all.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
            : all;
          const total = filtered.length;
          const items = filtered.slice((page - 1) * limit, page * limit);
          return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
        } catch (e) {
          throwSanitizedError('List forwarders', e);
        }
      }),

    create: adminProcedure
      .input(CreateForwardZoneInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const payload = {
            name: input.name,
            type: 'Zone',
            kind: 'Forwarded',
            servers: input.servers,
            recursion_desired: input.recursion_desired,
          };
          const result = await recursorClient.createForwarder(payload);
          await writeAuditLog({
            user: ctx.user,
            action: 'CREATE_FORWARDER',
            entityType: 'forwarder',
            entityId: input.name,
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Create forwarder', e);
        }
      }),

    update: adminProcedure
      .input(UpdateForwardZoneInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const current = await recursorClient.getForwarder(input.zoneId) as {
            name: string; type: string; kind: string;
          };
          const payload = {
            name: current.name,
            type: current.type,
            kind: current.kind,
            servers: input.servers,
            recursion_desired: input.recursion_desired,
          };
          const result = await recursorClient.updateForwarder(input.zoneId, payload);
          await writeAuditLog({
            user: ctx.user,
            action: 'UPDATE_FORWARDER',
            entityType: 'forwarder',
            entityId: input.zoneId,
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Update forwarder', e);
        }
      }),

    delete: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await recursorClient.deleteForwarder(input.zoneId);
          await writeAuditLog({
            user: ctx.user,
            action: 'DELETE_FORWARDER',
            entityType: 'forwarder',
            entityId: input.zoneId,
          });
          return { success: true };
        } catch (e) {
          throwSanitizedError('Delete forwarder', e);
        }
      }),
  }),

  config: router({
    list: protectedProcedure.query(async () => {
      try {
        return await recursorClient.getConfig();
      } catch (e) {
        throwSanitizedError('Fetch recursor config', e);
      }
    }),

    getAllowFrom: protectedProcedure.query(async () => {
      try {
        return await recursorClient.getAllowFrom();
      } catch (e) {
        throwSanitizedError('Get allow-from config', e);
      }
    }),

    setAllowFrom: adminProcedure
      .input(SetAllowFromInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await recursorClient.setAllowFrom(input.value);
          await writeAuditLog({
            user: ctx.user,
            action: 'UPDATE_ALLOW_FROM',
            entityType: 'config',
            entityId: 'allow-from',
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Update allow-from', e);
        }
      }),

    getAllowNotifyFrom: protectedProcedure.query(async () => {
      try {
        return await recursorClient.getAllowNotifyFrom();
      } catch (e) {
        throwSanitizedError('Get allow-notify-from config', e);
      }
    }),

    setAllowNotifyFrom: adminProcedure
      .input(SetAllowNotifyFromInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await recursorClient.setAllowNotifyFrom(input.value);
          await writeAuditLog({
            user: ctx.user,
            action: 'UPDATE_ALLOW_NOTIFY_FROM',
            entityType: 'config',
            entityId: 'allow-notify-from',
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Update allow-notify-from', e);
        }
      }),
  }),
});
