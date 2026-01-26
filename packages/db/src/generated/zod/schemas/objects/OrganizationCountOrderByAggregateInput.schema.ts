import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  deletedAt: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
  slug: SortOrderSchema.optional()
}).strict();
export const OrganizationCountOrderByAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationCountOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCountOrderByAggregateInput>;
export const OrganizationCountOrderByAggregateInputObjectZodSchema = makeSchema();
