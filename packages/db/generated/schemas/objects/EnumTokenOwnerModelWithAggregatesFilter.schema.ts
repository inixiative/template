import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { NestedEnumTokenOwnerModelWithAggregatesFilterObjectSchema as NestedEnumTokenOwnerModelWithAggregatesFilterObjectSchema } from './NestedEnumTokenOwnerModelWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumTokenOwnerModelFilterObjectSchema as NestedEnumTokenOwnerModelFilterObjectSchema } from './NestedEnumTokenOwnerModelFilter.schema'

const makeSchema = () => z.object({
  equals: TokenOwnerModelSchema.optional(),
  in: TokenOwnerModelSchema.array().optional(),
  notIn: TokenOwnerModelSchema.array().optional(),
  not: z.union([TokenOwnerModelSchema, z.lazy(() => NestedEnumTokenOwnerModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumTokenOwnerModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumTokenOwnerModelFilterObjectSchema).optional()
}).strict();
export const EnumTokenOwnerModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumTokenOwnerModelWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumTokenOwnerModelWithAggregatesFilter>;
export const EnumTokenOwnerModelWithAggregatesFilterObjectZodSchema = makeSchema();
