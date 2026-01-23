import * as z from 'zod';
export const UserAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    email: z.number(),
    emailVerified: z.number(),
    passwordHash: z.number(),
    name: z.number(),
    avatarUrl: z.number(),
    kycStatus: z.number(),
    kycProvider: z.number(),
    kycExternalId: z.number(),
    kycVerifiedAt: z.number(),
    region: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    sessions: z.number(),
    wallets: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    email: z.string().nullable(),
    passwordHash: z.string().nullable(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    kycProvider: z.string().nullable(),
    kycExternalId: z.string().nullable(),
    kycVerifiedAt: z.date().nullable(),
    region: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    email: z.string().nullable(),
    passwordHash: z.string().nullable(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    kycProvider: z.string().nullable(),
    kycExternalId: z.string().nullable(),
    kycVerifiedAt: z.date().nullable(),
    region: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable()
  }).nullable().optional()});