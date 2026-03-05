import { z } from 'zod';

export const CreateUserInputSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  role: z.enum(['admin', 'viewer']).default('viewer'),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserInputSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1).max(64).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'viewer']).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
