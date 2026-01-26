import * as z from 'zod';
export const OrganizationUserAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    organizationId: z.number(),
    userId: z.number(),
    role: z.number(),
    entitlements: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    organization: z.number(),
    user: z.number(),
    tokens: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    organizationId: z.string().nullable(),
    userId: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    organizationId: z.string().nullable(),
    userId: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable()
  }).nullable().optional()});