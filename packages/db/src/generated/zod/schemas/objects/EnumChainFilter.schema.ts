import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema';
import { NestedEnumChainFilterObjectSchema as NestedEnumChainFilterObjectSchema } from './NestedEnumChainFilter.schema'

const makeSchema = () => z.object({
  equals: ChainSchema.optional(),
  in: ChainSchema.array().optional(),
  notIn: ChainSchema.array().optional(),
  not: z.union([ChainSchema, z.lazy(() => NestedEnumChainFilterObjectSchema)]).optional()
}).strict();
export const EnumChainFilterObjectSchema: z.ZodType<Prisma.EnumChainFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumChainFilter>;
export const EnumChainFilterObjectZodSchema = makeSchema();
