import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const OrganizationUserOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationUserOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserOrderByRelationAggregateInput>;
export const OrganizationUserOrderByRelationAggregateInputObjectZodSchema = makeSchema();
