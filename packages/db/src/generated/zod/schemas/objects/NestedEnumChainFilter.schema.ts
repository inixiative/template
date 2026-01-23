import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema'

const nestedenumchainfilterSchema = z.object({
  equals: ChainSchema.optional(),
  in: ChainSchema.array().optional(),
  notIn: ChainSchema.array().optional(),
  not: z.union([ChainSchema, z.lazy(() => NestedEnumChainFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumChainFilterObjectSchema: z.ZodType<Prisma.NestedEnumChainFilter> = nestedenumchainfilterSchema as unknown as z.ZodType<Prisma.NestedEnumChainFilter>;
export const NestedEnumChainFilterObjectZodSchema = nestedenumchainfilterSchema;
