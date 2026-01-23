import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumChainFilterObjectSchema as NestedEnumChainFilterObjectSchema } from './NestedEnumChainFilter.schema'

const nestedenumchainwithaggregatesfilterSchema = z.object({
  equals: ChainSchema.optional(),
  in: ChainSchema.array().optional(),
  notIn: ChainSchema.array().optional(),
  not: z.union([ChainSchema, z.lazy(() => NestedEnumChainWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumChainFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumChainFilterObjectSchema).optional()
}).strict();
export const NestedEnumChainWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumChainWithAggregatesFilter> = nestedenumchainwithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumChainWithAggregatesFilter>;
export const NestedEnumChainWithAggregatesFilterObjectZodSchema = nestedenumchainwithaggregatesfilterSchema;
