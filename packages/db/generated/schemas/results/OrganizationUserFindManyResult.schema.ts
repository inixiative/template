import * as z from 'zod';
export const OrganizationUserFindManyResultSchema = z.object({
  data: z.array(z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.unknown(),
  entitlements: z.unknown().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  organization: z.unknown(),
  user: z.unknown(),
  tokens: z.array(z.unknown())
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