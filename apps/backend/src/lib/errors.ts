import { TRPCError } from '@trpc/server';

/**
 * Wraps an external API call. Logs the full error server-side
 * and throws a generic TRPCError with a safe user-facing message.
 */
export function throwSanitizedError(operation: string, e: unknown): never {
  console.error(`[${operation}]`, e);
  const detail = e instanceof Error ? e.message : String(e);
  // Only forward messages that look safe (no stack traces, no internal paths)
  const safe = detail.length < 300 && !detail.includes('\n') && !detail.includes('at ')
    ? detail
    : `${operation} failed`;
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: safe });
}
