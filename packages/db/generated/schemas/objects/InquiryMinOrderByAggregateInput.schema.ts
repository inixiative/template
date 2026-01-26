import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  sentAt: SortOrderSchema.optional(),
  type: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  sourceModel: SortOrderSchema.optional(),
  sourceUserId: SortOrderSchema.optional(),
  sourceOrganizationId: SortOrderSchema.optional(),
  targetModel: SortOrderSchema.optional(),
  targetUserId: SortOrderSchema.optional(),
  targetOrganizationId: SortOrderSchema.optional()
}).strict();
export const InquiryMinOrderByAggregateInputObjectSchema: z.ZodType<Prisma.InquiryMinOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryMinOrderByAggregateInput>;
export const InquiryMinOrderByAggregateInputObjectZodSchema = makeSchema();
