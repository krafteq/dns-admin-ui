import { describe, it, expect } from 'vitest';
import { CreateForwardZoneInputSchema } from './recursor.js';

describe('CreateForwardZoneInputSchema', () => {
  it('accepts a valid forwarder', () => {
    const result = CreateForwardZoneInputSchema.safeParse({
      name: 'internal.example.com.',
      servers: ['192.168.1.1', '192.168.1.2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty servers array', () => {
    const result = CreateForwardZoneInputSchema.safeParse({
      name: 'internal.example.com.',
      servers: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing servers', () => {
    const result = CreateForwardZoneInputSchema.safeParse({ name: 'example.com.' });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = CreateForwardZoneInputSchema.safeParse({ name: '', servers: ['1.1.1.1'] });
    expect(result.success).toBe(false);
  });

  it('defaults recursion_desired to false', () => {
    const result = CreateForwardZoneInputSchema.safeParse({
      name: 'example.com.',
      servers: ['1.1.1.1'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recursion_desired).toBe(false);
    }
  });
});
