import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { InquiryCountOrderByAggregateInputObjectSchema as InquiryCountOrderByAggregateInputObjectSchema } from './InquiryCountOrderByAggregateInput.schema';
import { InquiryMaxOrderByAggregateInputObjectSchema as InquiryMaxOrderByAggregateInputObjectSchema } from './InquiryMaxOrderByAggregateInput.schema';
import { InquiryMinOrderByAggregateInputObjectSchema as InquiryMinOrderByAggregateInputObjectSchema } from './InquiryMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  sentAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  type: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  content: SortOrderSchema.optional(),
  resolution: SortOrderSchema.optional(),
  sourceModel: SortOrderSchema.optional(),
  sourceUserId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  sourceOrganizationId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  targetModel: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  targetUserId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  targetOrganizationId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  _count: z.lazy(() => InquiryCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => InquiryMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => InquiryMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const InquiryOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.InquiryOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryOrderByWithAggregationInput>;
export const InquiryOrderByWithAggregationInputObjectZodSchema = makeSchema();
