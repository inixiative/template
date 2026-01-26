import * as z from 'zod';
export const TokenFindManyResultSchema = z.object({
  data: z.array(z.object({
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
})),
  pagination: z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
})
});