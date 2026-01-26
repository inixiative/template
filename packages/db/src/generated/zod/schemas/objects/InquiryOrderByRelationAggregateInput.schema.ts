import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const InquiryOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.InquiryOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryOrderByRelationAggregateInput>;
export const InquiryOrderByRelationAggregateInputObjectZodSchema = makeSchema();
