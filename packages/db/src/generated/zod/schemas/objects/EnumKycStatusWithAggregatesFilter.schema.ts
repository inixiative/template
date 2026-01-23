import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema';
import { NestedEnumKycStatusWithAggregatesFilterObjectSchema as NestedEnumKycStatusWithAggregatesFilterObjectSchema } from './NestedEnumKycStatusWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumKycStatusFilterObjectSchema as NestedEnumKycStatusFilterObjectSchema } from './NestedEnumKycStatusFilter.schema'

const makeSchema = () => z.object({
  equals: KycStatusSchema.optional(),
  in: KycStatusSchema.array().optional(),
  notIn: KycStatusSchema.array().optional(),
  not: z.union([KycStatusSchema, z.lazy(() => NestedEnumKycStatusWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumKycStatusFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumKycStatusFilterObjectSchema).optional()
}).strict();
export const EnumKycStatusWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumKycStatusWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumKycStatusWithAggregatesFilter>;
export const EnumKycStatusWithAggregatesFilterObjectZodSchema = makeSchema();
