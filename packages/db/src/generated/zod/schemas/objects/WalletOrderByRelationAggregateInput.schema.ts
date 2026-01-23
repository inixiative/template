import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const WalletOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.WalletOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletOrderByRelationAggregateInput>;
export const WalletOrderByRelationAggregateInputObjectZodSchema = makeSchema();
