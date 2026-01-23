import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema';
import { NestedEnumChainWithAggregatesFilterObjectSchema as NestedEnumChainWithAggregatesFilterObjectSchema } from './NestedEnumChainWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumChainFilterObjectSchema as NestedEnumChainFilterObjectSchema } from './NestedEnumChainFilter.schema'

const makeSchema = () => z.object({
  equals: ChainSchema.optional(),
  in: ChainSchema.array().optional(),
  notIn: ChainSchema.array().optional(),
  not: z.union([ChainSchema, z.lazy(() => NestedEnumChainWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumChainFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumChainFilterObjectSchema).optional()
}).strict();
export const EnumChainWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumChainWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumChainWithAggregatesFilter>;
export const EnumChainWithAggregatesFilterObjectZodSchema = makeSchema();
