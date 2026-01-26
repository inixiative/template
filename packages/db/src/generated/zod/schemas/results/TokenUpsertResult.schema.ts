import * as z from 'zod';
export const TokenUpsertResultSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  keyHash: z.string(),
  keyPrefix: z.string(),
  ownerModel: z.unknown(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  user: z.unknown().optional(),
  organization: z.unknown().optional(),
  organizationUser: z.unknown().optional(),
  role: z.unknown(),
  entitlements: z.unknown().optional(),
  expiresAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
  isActive: z.boolean()
});