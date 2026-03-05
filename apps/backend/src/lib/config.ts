export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-me'
);

export const BCRYPT_ROUNDS = 12;

if (process.env.NODE_ENV === 'production') {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    console.error(
      'FATAL: JWT_SECRET must be at least 32 characters in production. ' +
        'Set a strong random secret in your .env file.'
    );
    process.exit(1);
  }
}
