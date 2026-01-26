import * as z from 'zod';
export const OrganizationAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number(),
    name: z.number(),
    slug: z.number(),
    organizationUsers: z.number(),
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
  }).nullable().optional()});