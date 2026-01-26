import * as z from 'zod';
export const OrganizationDeleteResultSchema = z.nullable(z.object({
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
}));