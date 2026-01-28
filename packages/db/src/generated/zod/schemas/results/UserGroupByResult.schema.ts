import * as z from 'zod';
export const UserGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date(),
  email: z.string(),
  emailVerified: z.boolean(),
  name: z.string(),
  displayName: z.string(),
  image: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number(),
    email: z.number(),
    emailVerified: z.number(),
    name: z.number(),
    displayName: z.number(),
    image: z.number(),
    platformRole: z.number(),
    accounts: z.number(),
    sessions: z.number(),
    organizationUsers: z.number(),
    tokens: z.number(),
    cronJobsCreated: z.number(),
    webhookSubscriptions: z.number(),
    inquiriesSent: z.number(),
    inquiriesReceived: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    deletedAt: z.date().nullable(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    displayName: z.string().nullable(),
    image: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    deletedAt: z.date().nullable(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    displayName: z.string().nullable(),
    image: z.string().nullable()
  }).nullable().optional()
}));