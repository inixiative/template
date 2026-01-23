import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  email: SortOrderSchema.optional(),
  emailVerified: SortOrderSchema.optional(),
  passwordHash: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
  avatarUrl: SortOrderSchema.optional(),
  kycStatus: SortOrderSchema.optional(),
  kycProvider: SortOrderSchema.optional(),
  kycExternalId: SortOrderSchema.optional(),
  kycVerifiedAt: SortOrderSchema.optional(),
  region: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional()
}).strict();
export const UserMaxOrderByAggregateInputObjectSchema: z.ZodType<Prisma.UserMaxOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.UserMaxOrderByAggregateInput>;
export const UserMaxOrderByAggregateInputObjectZodSchema = makeSchema();
