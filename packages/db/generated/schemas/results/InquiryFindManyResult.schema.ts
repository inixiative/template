import * as z from 'zod';
export const InquiryFindManyResultSchema = z.object({
  data: z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sentAt: z.date().optional(),
  type: z.unknown(),
  status: z.unknown(),
  content: z.unknown(),
  resolution: z.unknown(),
  sourceModel: z.unknown(),
  sourceUserId: z.string().optional(),
  sourceOrganizationId: z.string().optional(),
  sourceUser: z.unknown().optional(),
  sourceOrganization: z.unknown().optional(),
  targetModel: z.unknown().optional(),
  targetUserId: z.string().optional(),
  targetOrganizationId: z.string().optional(),
  targetUser: z.unknown().optional(),
  targetOrganization: z.unknown().optional()
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