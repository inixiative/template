import * as z from 'zod';
export const OrganizationFindManyResultSchema = z.object({
  data: z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
  name: z.string(),
  slug: z.string(),
  users: z.array(z.unknown()),
  tokens: z.array(z.unknown()),
  webhookSubscriptions: z.array(z.unknown()),
  inquiriesSent: z.array(z.unknown()),
  inquiriesReceived: z.array(z.unknown())
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