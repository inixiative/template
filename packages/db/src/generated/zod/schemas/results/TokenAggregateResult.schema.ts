import * as z from 'zod';
export const TokenAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    name: z.number(),
    keyHash: z.number(),
    keyPrefix: z.number(),
    ownerModel: z.number(),
    userId: z.number(),
    organizationId: z.number(),
    user: z.number(),
    organization: z.number(),
    organizationUser: z.number(),
    role: z.number(),
    entitlements: z.number(),
    expiresAt: z.number(),
    lastUsedAt: z.number(),
    isActive: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    name: z.string().nullable(),
    keyHash: z.string().nullable(),
    keyPrefix: z.string().nullable(),
    userId: z.string().nullable(),
    organizationId: z.string().nullable(),
    expiresAt: z.date().nullable(),
    lastUsedAt: z.date().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    name: z.string().nullable(),
    keyHash: z.string().nullable(),
    keyPrefix: z.string().nullable(),
    userId: z.string().nullable(),
    organizationId: z.string().nullable(),
    expiresAt: z.date().nullable(),
    lastUsedAt: z.date().nullable()
  }).nullable().optional()});