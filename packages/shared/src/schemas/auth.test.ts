import { describe, it, expect } from 'vitest';
import { LoginInputSchema, UserSchema } from './auth.js';

describe('LoginInputSchema', () => {
  it('accepts valid credentials', () => {
    const result = LoginInputSchema.safeParse({ username: 'admin', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects empty username', () => {
    const result = LoginInputSchema.safeParse({ username: '', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = LoginInputSchema.safeParse({ username: 'admin', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = LoginInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('UserSchema', () => {
  it('parses a valid user object', () => {
    const result = UserSchema.safeParse({
      id: 1,
      username: 'admin',
      role: 'admin',
      createdAt: 1700000000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('admin');
      expect(result.data.role).toBe('admin');
    }
  });

  it('rejects missing id', () => {
    const result = UserSchema.safeParse({ username: 'admin', role: 'admin', createdAt: 0 });
    expect(result.success).toBe(false);
  });
});
