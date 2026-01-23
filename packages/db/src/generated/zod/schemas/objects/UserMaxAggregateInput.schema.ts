import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  email: z.literal(true).optional(),
  emailVerified: z.literal(true).optional(),
  passwordHash: z.literal(true).optional(),
  name: z.literal(true).optional(),
  avatarUrl: z.literal(true).optional(),
  kycStatus: z.literal(true).optional(),
  kycProvider: z.literal(true).optional(),
  kycExternalId: z.literal(true).optional(),
  kycVerifiedAt: z.literal(true).optional(),
  region: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional()
}).strict();
export const UserMaxAggregateInputObjectSchema: z.ZodType<Prisma.UserMaxAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.UserMaxAggregateInputType>;
export const UserMaxAggregateInputObjectZodSchema = makeSchema();
