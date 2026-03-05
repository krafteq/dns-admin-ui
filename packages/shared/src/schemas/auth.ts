import { z } from 'zod';

export const LoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.string(),
  oidcIssuer: z.string().nullable().optional(),
  createdAt: z.number(),
});
export type User = z.infer<typeof UserSchema>;
