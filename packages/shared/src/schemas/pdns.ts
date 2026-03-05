import { z } from 'zod';

export const DNS_RECORD_TYPES = [
  'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SRV', 'CAA', 'SOA',
  'ALIAS', 'DNAME', 'LOC', 'NAPTR', 'RP', 'SSHFP', 'TLSA', 'URI',
] as const;

export const RRSetRecordSchema = z.object({
  content: z.string().max(65535),
  disabled: z.boolean().optional().default(false),
});

export const RRSetSchema = z.object({
  name: z.string().max(255),
  type: z.string().max(10),
  ttl: z.number().int().min(0).max(2147483647).optional(),
  changetype: z.enum(['REPLACE', 'DELETE']).optional(),
  records: z.array(RRSetRecordSchema).optional(),
  comments: z.array(z.any()).optional(),
});
export type RRSet = z.infer<typeof RRSetSchema>;

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string().max(255),
  type: z.string(),
  url: z.string().optional(),
  kind: z.enum(['Native', 'Master', 'Slave', 'Producer', 'Consumer']).optional(),
  rrsets: z.array(RRSetSchema).optional(),
  serial: z.number().optional(),
  notified_serial: z.number().optional(),
  last_check: z.number().optional(),
  dnssec: z.boolean().optional(),
  account: z.string().max(255).optional(),
  masters: z.array(z.string().max(255)).optional(),
  nameservers: z.array(z.string().max(255)).optional(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const CreateZoneInputSchema = z.object({
  name: z.string().min(1).max(255),
  kind: z.enum(['Native', 'Master', 'Slave']),
  nameservers: z.array(z.string().max(255)).optional().default([]),
  masters: z.array(z.string().max(255)).optional().default([]),
  account: z.string().max(255).optional().default(''),
});
export type CreateZoneInput = z.infer<typeof CreateZoneInputSchema>;

export const PatchRRSetsInputSchema = z.object({
  zoneId: z.string(),
  rrsets: z.array(RRSetSchema),
});
export type PatchRRSetsInput = z.infer<typeof PatchRRSetsInputSchema>;

export const ServerInfoSchema = z.object({
  type: z.string(),
  id: z.string(),
  url: z.string(),
  daemon_type: z.string(),
  version: z.string(),
  config_url: z.string(),
  zones_url: z.string(),
});
export type ServerInfo = z.infer<typeof ServerInfoSchema>;

export const CryptoKeySchema = z.object({
  id: z.number(),
  type: z.string(),
  active: z.boolean(),
  published: z.boolean().optional(),
  dnskey: z.string().optional(),
  ds: z.array(z.string()).optional(),
  algorithm: z.string().optional(),
  bits: z.number().optional(),
  flags: z.number().optional(),
});
export type CryptoKey = z.infer<typeof CryptoKeySchema>;

export const TsigKeySchema = z.object({
  id: z.string().optional(),
  name: z.string().max(255),
  algorithm: z.string().max(64),
  key: z.string().max(4096).optional(),
  type: z.string().optional(),
});
export type TsigKey = z.infer<typeof TsigKeySchema>;

export const CreateTsigKeyInputSchema = z.object({
  name: z.string().min(1).max(255),
  algorithm: z.string().min(1).max(64),
  key: z.string().max(4096).optional(),
});
export type CreateTsigKeyInput = z.infer<typeof CreateTsigKeyInputSchema>;

export const UpdateTsigKeyInputSchema = z.object({
  name: z.string().max(255).optional(),
  algorithm: z.string().max(64).optional(),
  key: z.string().max(4096).optional(),
});
export type UpdateTsigKeyInput = z.infer<typeof UpdateTsigKeyInputSchema>;

export const ZoneMetadataSchema = z.object({
  kind: z.string().max(255),
  metadata: z.array(z.string().max(4096)),
});
export type ZoneMetadata = z.infer<typeof ZoneMetadataSchema>;

export const AutoprimarySchema = z.object({
  ip: z.string().max(255),
  nameserver: z.string().max(255),
  account: z.string().max(255).optional(),
});
export type Autoprimary = z.infer<typeof AutoprimarySchema>;

export const CreateAutoprimaryInputSchema = z.object({
  ip: z.string().min(1).max(255),
  nameserver: z.string().min(1).max(255),
  account: z.string().max(255).optional(),
});
export type CreateAutoprimaryInput = z.infer<typeof CreateAutoprimaryInputSchema>;

export const SearchResultItemSchema = z.object({
  object_type: z.string(),
  name: z.string().optional(),
  zone_id: z.string().optional(),
  zone: z.string().optional(),
  type: z.string().optional(),
  content: z.string().optional(),
});
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
