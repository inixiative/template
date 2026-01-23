import * as z from 'zod';
export const UserFindFirstResultSchema = z.nullable(z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  passwordHash: z.string().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  kycStatus: z.unknown(),
  kycProvider: z.string().optional(),
  kycExternalId: z.string().optional(),
  kycVerifiedAt: z.date().optional(),
  region: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sessions: z.array(z.unknown()),
  wallets: z.array(z.unknown())
}));