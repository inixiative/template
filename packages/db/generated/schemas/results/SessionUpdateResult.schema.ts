import * as z from 'zod';
export const SessionUpdateResultSchema = z.nullable(z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.unknown()
}));