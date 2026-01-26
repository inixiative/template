import * as z from 'zod';
export const WebhookSubscriptionFindManyResultSchema = z.object({
  data: z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  model: z.unknown(),
  url: z.string(),
  secret: z.string().optional(),
  isActive: z.boolean(),
  ownerModel: z.unknown(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  user: z.unknown().optional(),
  organization: z.unknown().optional(),
  events: z.array(z.unknown())
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