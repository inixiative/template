import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumTokenOwnerModelFilterObjectSchema as NestedEnumTokenOwnerModelFilterObjectSchema } from './NestedEnumTokenOwnerModelFilter.schema'

const nestedenumtokenownermodelwithaggregatesfilterSchema = z.object({
  equals: TokenOwnerModelSchema.optional(),
  in: TokenOwnerModelSchema.array().optional(),
  notIn: TokenOwnerModelSchema.array().optional(),
  not: z.union([TokenOwnerModelSchema, z.lazy(() => NestedEnumTokenOwnerModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumTokenOwnerModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumTokenOwnerModelFilterObjectSchema).optional()
}).strict();
export const NestedEnumTokenOwnerModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumTokenOwnerModelWithAggregatesFilter> = nestedenumtokenownermodelwithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumTokenOwnerModelWithAggregatesFilter>;
export const NestedEnumTokenOwnerModelWithAggregatesFilterObjectZodSchema = nestedenumtokenownermodelwithaggregatesfilterSchema;
