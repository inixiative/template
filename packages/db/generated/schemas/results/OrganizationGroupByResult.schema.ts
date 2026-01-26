import * as z from 'zod';
export const OrganizationGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date(),
  name: z.string(),
  slug: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number(),
    name: z.number(),
    slug: z.number(),
    users: z.number(),
    tokens: z.number(),
    webhookSubscriptions: z.number(),
    inquiriesSent: z.number(),
    inquiriesReceived: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    deletedAt: z.date().nullable(),
    name: z.string().nullable(),
    slug: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    deletedAt: z.date().nullable(),
    name: z.string().nullable(),
    slug: z.string().nullable()
  }).nullable().optional()
}));