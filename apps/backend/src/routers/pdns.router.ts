import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { pdnsClient } from '../services/pdns.client.js';
import { writeAuditLog } from '../lib/audit.js';
import { throwSanitizedError } from '../lib/errors.js';
import {
  CreateZoneInputSchema,
  RRSetSchema,
  CreateTsigKeyInputSchema,
  UpdateTsigKeyInputSchema,
  CreateAutoprimaryInputSchema,
} from '@dns-admin/shared';

export const pdnsRouter = router({
  server: router({
    info: protectedProcedure.query(async () => {
      try {
        return await pdnsClient.getServerInfo();
      } catch (e) {
        throwSanitizedError('Fetch server info', e);
      }
    }),
    stats: protectedProcedure.query(async () => {
      try {
        return await pdnsClient.getStats();
      } catch (e) {
        throwSanitizedError('Fetch server stats', e);
      }
    }),
  }),

  zones: router({
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
          const allZones = await pdnsClient.listZones() as Array<{
            id: string; name: string; kind?: string; serial?: number; dnssec?: boolean;
          }>;
          const page = input?.page ?? 1;
          const limit = input?.limit ?? 50;
          const search = input?.search;
          const filtered = search
            ? allZones.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()))
            : allZones;
          const total = filtered.length;
          const items = filtered.slice((page - 1) * limit, page * limit);
          return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
        } catch (e) {
          throwSanitizedError('List zones', e);
        }
      }),

    get: protectedProcedure
      .input(z.object({ zoneId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.getZone(input.zoneId);
        } catch (e) {
          throwSanitizedError('Get zone', e);
        }
      }),

    create: adminProcedure
      .input(CreateZoneInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.createZone(input);
          await writeAuditLog({
            user: ctx.user,
            action: 'CREATE_ZONE',
            entityType: 'zone',
            entityId: input.name,
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Create zone', e);
        }
      }),

    update: adminProcedure
      .input(z.object({ zoneId: z.string(), data: z.record(z.unknown()) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const before = await pdnsClient.getZone(input.zoneId);
          const result = await pdnsClient.updateZone(input.zoneId, input.data);
          await writeAuditLog({
            user: ctx.user,
            action: 'UPDATE_ZONE',
            entityType: 'zone',
            entityId: input.zoneId,
            payloadBefore: before,
            payloadAfter: input.data,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Update zone', e);
        }
      }),

    delete: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const before = await pdnsClient.getZone(input.zoneId);
          await pdnsClient.deleteZone(input.zoneId);
          await writeAuditLog({
            user: ctx.user,
            action: 'DELETE_ZONE',
            entityType: 'zone',
            entityId: input.zoneId,
            payloadBefore: before,
          });
          return { success: true };
        } catch (e) {
          throwSanitizedError('Delete zone', e);
        }
      }),

    rectify: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.rectifyZone(input.zoneId);
          await writeAuditLog({
            user: ctx.user,
            action: 'RECTIFY_ZONE',
            entityType: 'zone',
            entityId: input.zoneId,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Rectify zone', e);
        }
      }),

    axfrRetrieve: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.axfrRetrieve(input.zoneId);
          await writeAuditLog({
            user: ctx.user,
            action: 'AXFR_RETRIEVE',
            entityType: 'zone',
            entityId: input.zoneId,
          });
          return result;
        } catch (e) {
          throwSanitizedError('AXFR retrieve', e);
        }
      }),

    notify: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.notifyZone(input.zoneId);
          await writeAuditLog({
            user: ctx.user,
            action: 'NOTIFY_ZONE',
            entityType: 'zone',
            entityId: input.zoneId,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Notify zone', e);
        }
      }),

    export: protectedProcedure
      .input(z.object({ zoneId: z.string() }))
      .query(async ({ input }) => {
        try {
          const content = await pdnsClient.exportZone(input.zoneId);
          return { content };
        } catch (e) {
          throwSanitizedError('Export zone', e);
        }
      }),
  }),

  records: router({
    patch: adminProcedure
      .input(z.object({ zoneId: z.string(), rrsets: z.array(RRSetSchema) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.patchZoneRRSets(input.zoneId, input.rrsets);
          await writeAuditLog({
            user: ctx.user,
            action: 'PATCH_RECORDS',
            entityType: 'record',
            entityId: input.zoneId,
            payloadAfter: input.rrsets,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Patch records', e);
        }
      }),
  }),

  cache: router({
    flush: adminProcedure
      .input(z.object({ domain: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.flushCache(input.domain);
          await writeAuditLog({
            user: ctx.user,
            action: 'FLUSH_CACHE',
            entityType: 'cache',
            entityId: input.domain ?? '*',
          });
          return result;
        } catch (e) {
          throwSanitizedError('Flush cache', e);
        }
      }),
  }),

  metadata: router({
    list: protectedProcedure
      .input(z.object({ zoneId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.listMetadata(input.zoneId);
        } catch (e) {
          throwSanitizedError('List metadata', e);
        }
      }),

    create: adminProcedure
      .input(z.object({ zoneId: z.string(), kind: z.string(), metadata: z.array(z.string()) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.createMetadata(input.zoneId, { kind: input.kind, metadata: input.metadata });
          await writeAuditLog({
            user: ctx.user,
            action: 'CREATE_METADATA',
            entityType: 'zone',
            entityId: input.zoneId,
            payloadAfter: { kind: input.kind, metadata: input.metadata },
          });
          return result;
        } catch (e) {
          throwSanitizedError('Create metadata', e);
        }
      }),

    get: protectedProcedure
      .input(z.object({ zoneId: z.string(), kind: z.string() }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.getMetadata(input.zoneId, input.kind);
        } catch (e) {
          throwSanitizedError('Get metadata', e);
        }
      }),

    update: adminProcedure
      .input(z.object({ zoneId: z.string(), kind: z.string(), metadata: z.array(z.string()) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.updateMetadata(input.zoneId, input.kind, { metadata: input.metadata });
          await writeAuditLog({
            user: ctx.user,
            action: 'UPDATE_METADATA',
            entityType: 'zone',
            entityId: input.zoneId,
            payloadAfter: { kind: input.kind, metadata: input.metadata },
          });
          return result;
        } catch (e) {
          throwSanitizedError('Update metadata', e);
        }
      }),

    delete: adminProcedure
      .input(z.object({ zoneId: z.string(), kind: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await pdnsClient.deleteMetadata(input.zoneId, input.kind);
          await writeAuditLog({
            user: ctx.user,
            action: 'DELETE_METADATA',
            entityType: 'zone',
            entityId: input.zoneId,
            payloadBefore: { kind: input.kind },
          });
          return { success: true };
        } catch (e) {
          throwSanitizedError('Delete metadata', e);
        }
      }),
  }),

  tsigkeys: router({
    list: protectedProcedure
      .query(async () => {
        try {
          // List endpoint omits the key secret — fetch each key's details
          const keys = await pdnsClient.listTsigKeys() as { id: string }[];
          return await Promise.all(
            keys.map((k) => pdnsClient.getTsigKey(k.id))
          );
        } catch (e) {
          throwSanitizedError('List TSIG keys', e);
        }
      }),

    create: adminProcedure
      .input(CreateTsigKeyInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.createTsigKey(input);
          await writeAuditLog({
            user: ctx.user,
            action: 'CREATE_TSIG_KEY',
            entityType: 'tsigkey',
            entityId: input.name,
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Create TSIG key', e);
        }
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.getTsigKey(input.id);
        } catch (e) {
          throwSanitizedError('Get TSIG key', e);
        }
      }),

    update: adminProcedure
      .input(z.object({ id: z.string() }).merge(UpdateTsigKeyInputSchema))
      .mutation(async ({ input, ctx }) => {
        try {
          const { id, ...data } = input;
          const result = await pdnsClient.updateTsigKey(id, data);
          await writeAuditLog({
            user: ctx.user,
            action: 'UPDATE_TSIG_KEY',
            entityType: 'tsigkey',
            entityId: id,
            payloadAfter: data,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Update TSIG key', e);
        }
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await pdnsClient.deleteTsigKey(input.id);
          await writeAuditLog({
            user: ctx.user,
            action: 'DELETE_TSIG_KEY',
            entityType: 'tsigkey',
            entityId: input.id,
          });
          return { success: true };
        } catch (e) {
          throwSanitizedError('Delete TSIG key', e);
        }
      }),
  }),

  autoprimaries: router({
    list: protectedProcedure
      .query(async () => {
        try {
          return await pdnsClient.listAutoprimaries();
        } catch (e) {
          throwSanitizedError('List autoprimaries', e);
        }
      }),

    create: adminProcedure
      .input(CreateAutoprimaryInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.createAutoprimary(input);
          await writeAuditLog({
            user: ctx.user,
            action: 'CREATE_AUTOPRIMARY',
            entityType: 'autoprimary',
            entityId: `${input.ip}/${input.nameserver}`,
            payloadAfter: input,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Create autoprimary', e);
        }
      }),

    delete: adminProcedure
      .input(z.object({ ip: z.string(), nameserver: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await pdnsClient.deleteAutoprimary(input.ip, input.nameserver);
          await writeAuditLog({
            user: ctx.user,
            action: 'DELETE_AUTOPRIMARY',
            entityType: 'autoprimary',
            entityId: `${input.ip}/${input.nameserver}`,
          });
          return { success: true };
        } catch (e) {
          throwSanitizedError('Delete autoprimary', e);
        }
      }),
  }),

  search: router({
    search: protectedProcedure
      .input(z.object({
        q: z.string(),
        max: z.number().int().positive().optional(),
        objectType: z.enum(['all', 'zone', 'record', 'comment']).optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.searchData(input.q, input.max, input.objectType);
        } catch (e) {
          throwSanitizedError('Search', e);
        }
      }),
  }),

  dnssec: router({
    listKeys: protectedProcedure
      .input(z.object({ zoneId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.listCryptoKeys(input.zoneId);
        } catch (e) {
          throwSanitizedError('List DNSSEC keys', e);
        }
      }),

    getKey: protectedProcedure
      .input(z.object({ zoneId: z.string(), keyId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await pdnsClient.getCryptoKey(input.zoneId, input.keyId);
        } catch (e) {
          throwSanitizedError('Get DNSSEC key', e);
        }
      }),

    enable: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.createCryptoKey(input.zoneId, {
            keytype: 'ksk',
            active: true,
            algorithm: 'ecdsa256',
          });
          await writeAuditLog({
            user: ctx.user,
            action: 'ENABLE_DNSSEC',
            entityType: 'zone',
            entityId: input.zoneId,
          });
          return result;
        } catch (e) {
          throwSanitizedError('Enable DNSSEC', e);
        }
      }),

    disable: adminProcedure
      .input(z.object({ zoneId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const keys = await pdnsClient.listCryptoKeys(input.zoneId) as Array<{ id: number }>;
          for (const k of keys) {
            await pdnsClient.deleteCryptoKey(input.zoneId, k.id);
          }
          await writeAuditLog({
            user: ctx.user,
            action: 'DISABLE_DNSSEC',
            entityType: 'zone',
            entityId: input.zoneId,
          });
          return { success: true };
        } catch (e) {
          throwSanitizedError('Disable DNSSEC', e);
        }
      }),

    toggleKey: adminProcedure
      .input(z.object({ zoneId: z.string(), keyId: z.number(), active: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await pdnsClient.updateCryptoKey(input.zoneId, input.keyId, {
            active: input.active,
          });
          await writeAuditLog({
            user: ctx.user,
            action: 'TOGGLE_DNSSEC_KEY',
            entityType: 'zone',
            entityId: input.zoneId,
            payloadAfter: { keyId: input.keyId, active: input.active },
          });
          return result;
        } catch (e) {
          throwSanitizedError('Toggle DNSSEC key', e);
        }
      }),
  }),
});
