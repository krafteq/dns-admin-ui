import { describe, it, expect } from 'vitest';
import { CreateZoneInputSchema, RRSetSchema, CryptoKeySchema } from './pdns.js';

describe('CreateZoneInputSchema', () => {
  it('accepts a valid Native zone', () => {
    const result = CreateZoneInputSchema.safeParse({
      name: 'example.com.',
      kind: 'Native',
      nameservers: ['ns1.example.com.'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid Slave zone with masters', () => {
    const result = CreateZoneInputSchema.safeParse({
      name: 'slave.example.com.',
      kind: 'Slave',
      masters: ['192.168.1.1'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid kind', () => {
    const result = CreateZoneInputSchema.safeParse({
      name: 'example.com.',
      kind: 'Invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = CreateZoneInputSchema.safeParse({ name: '', kind: 'Native' });
    expect(result.success).toBe(false);
  });
});

describe('RRSetSchema', () => {
  it('parses a valid REPLACE rrset', () => {
    const result = RRSetSchema.safeParse({
      name: 'example.com.',
      type: 'A',
      ttl: 300,
      changetype: 'REPLACE',
      records: [{ content: '1.2.3.4', disabled: false }],
    });
    expect(result.success).toBe(true);
  });

  it('parses a valid DELETE rrset', () => {
    const result = RRSetSchema.safeParse({
      name: 'example.com.',
      type: 'A',
      changetype: 'DELETE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid changetype', () => {
    const result = RRSetSchema.safeParse({
      name: 'example.com.',
      type: 'A',
      changetype: 'ADD',
    });
    expect(result.success).toBe(false);
  });
});

describe('CryptoKeySchema', () => {
  it('parses a typical KSK object', () => {
    const result = CryptoKeySchema.safeParse({
      id: 1,
      type: 'ksk',
      active: true,
      published: true,
      algorithm: 'ECDSAP256SHA256',
      bits: 256,
      flags: 257,
      ds: ['1 13 2 abcdef1234567890'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('ksk');
      expect(result.data.active).toBe(true);
    }
  });

  it('parses a key without optional fields', () => {
    const result = CryptoKeySchema.safeParse({ id: 2, type: 'zsk', active: false });
    expect(result.success).toBe(true);
  });
});
