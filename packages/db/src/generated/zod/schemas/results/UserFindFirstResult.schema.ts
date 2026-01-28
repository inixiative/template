import * as z from 'zod';
export const UserFindFirstResultSchema = z.nullable(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
  email: z.string(),
  emailVerified: z.boolean(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  image: z.string().optional(),
  platformRole: z.unknown(),
  accounts: z.array(z.unknown()),
  sessions: z.array(z.unknown()),
  organizationUsers: z.array(z.unknown()),
  tokens: z.array(z.unknown()),
  cronJobsCreated: z.array(z.unknown()),
  webhookSubscriptions: z.array(z.unknown()),
  inquiriesSent: z.array(z.unknown()),
  inquiriesReceived: z.array(z.unknown())
}));