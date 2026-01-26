import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const TokenOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.TokenOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenOrderByRelationAggregateInput>;
export const TokenOrderByRelationAggregateInputObjectZodSchema = makeSchema();
