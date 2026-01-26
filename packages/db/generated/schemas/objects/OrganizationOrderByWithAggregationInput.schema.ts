import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { OrganizationCountOrderByAggregateInputObjectSchema as OrganizationCountOrderByAggregateInputObjectSchema } from './OrganizationCountOrderByAggregateInput.schema';
import { OrganizationMaxOrderByAggregateInputObjectSchema as OrganizationMaxOrderByAggregateInputObjectSchema } from './OrganizationMaxOrderByAggregateInput.schema';
import { OrganizationMinOrderByAggregateInputObjectSchema as OrganizationMinOrderByAggregateInputObjectSchema } from './OrganizationMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  deletedAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  name: SortOrderSchema.optional(),
  slug: SortOrderSchema.optional(),
  _count: z.lazy(() => OrganizationCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => OrganizationMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => OrganizationMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const OrganizationOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.OrganizationOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationOrderByWithAggregationInput>;
export const OrganizationOrderByWithAggregationInputObjectZodSchema = makeSchema();
