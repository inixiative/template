import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  organizationId: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  role: SortOrderSchema.optional(),
  entitlements: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional()
}).strict();
export const OrganizationUserCountOrderByAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationUserCountOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCountOrderByAggregateInput>;
export const OrganizationUserCountOrderByAggregateInputObjectZodSchema = makeSchema();
