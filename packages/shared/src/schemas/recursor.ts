import { z } from 'zod';

export const StatItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.union([z.string(), z.number()]),
});
export type StatItem = z.infer<typeof StatItemSchema>;

export const CacheStatsSchema = z.object({
  size: z.number().optional(),
});
export type CacheStats = z.infer<typeof CacheStatsSchema>;

export const ForwardZoneSchema = z.object({
  id: z.string(),
  name: z.string().max(255),
  kind: z.string(),
  servers: z.array(z.string().max(255)).optional(),
  recursion_desired: z.boolean().optional(),
});
export type ForwardZone = z.infer<typeof ForwardZoneSchema>;

export const CreateForwardZoneInputSchema = z.object({
  name: z.string().min(1).max(255),
  servers: z.array(z.string().min(1).max(255)).min(1, 'At least one forwarder required'),
  recursion_desired: z.boolean().optional().default(false),
});
export type CreateForwardZoneInput = z.infer<typeof CreateForwardZoneInputSchema>;

export const RecursorConfigItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type RecursorConfigItem = z.infer<typeof RecursorConfigItemSchema>;

export const SetAllowFromInputSchema = z.object({
  value: z.array(z.string().max(255)),
});
export type SetAllowFromInput = z.infer<typeof SetAllowFromInputSchema>;

export const SetAllowNotifyFromInputSchema = z.object({
  value: z.array(z.string().max(255)),
});
export type SetAllowNotifyFromInput = z.infer<typeof SetAllowNotifyFromInputSchema>;

export const RingEntrySchema = z.object({
  name: z.string(),
  count: z.number(),
});
export type RingEntry = z.infer<typeof RingEntrySchema>;

export const UpdateForwardZoneInputSchema = z.object({
  zoneId: z.string(),
  servers: z.array(z.string().min(1).max(255)).min(1, 'At least one forwarder required'),
  recursion_desired: z.boolean().optional().default(false),
});
export type UpdateForwardZoneInput = z.infer<typeof UpdateForwardZoneInputSchema>;

export const RecursorServerInfoSchema = z.object({
  id: z.string(),
  daemon_type: z.string(),
  version: z.string(),
  type: z.string(),
  url: z.string(),
});
export type RecursorServerInfo = z.infer<typeof RecursorServerInfoSchema>;
