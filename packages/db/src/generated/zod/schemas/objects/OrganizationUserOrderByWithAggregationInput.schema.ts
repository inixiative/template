import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { OrganizationUserCountOrderByAggregateInputObjectSchema as OrganizationUserCountOrderByAggregateInputObjectSchema } from './OrganizationUserCountOrderByAggregateInput.schema';
import { OrganizationUserMaxOrderByAggregateInputObjectSchema as OrganizationUserMaxOrderByAggregateInputObjectSchema } from './OrganizationUserMaxOrderByAggregateInput.schema';
import { OrganizationUserMinOrderByAggregateInputObjectSchema as OrganizationUserMinOrderByAggregateInputObjectSchema } from './OrganizationUserMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  organizationId: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  role: SortOrderSchema.optional(),
  entitlements: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  _count: z.lazy(() => OrganizationUserCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => OrganizationUserMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => OrganizationUserMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const OrganizationUserOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.OrganizationUserOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserOrderByWithAggregationInput>;
export const OrganizationUserOrderByWithAggregationInputObjectZodSchema = makeSchema();
