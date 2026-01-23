import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumKycStatusFilterObjectSchema as NestedEnumKycStatusFilterObjectSchema } from './NestedEnumKycStatusFilter.schema'

const nestedenumkycstatuswithaggregatesfilterSchema = z.object({
  equals: KycStatusSchema.optional(),
  in: KycStatusSchema.array().optional(),
  notIn: KycStatusSchema.array().optional(),
  not: z.union([KycStatusSchema, z.lazy(() => NestedEnumKycStatusWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumKycStatusFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumKycStatusFilterObjectSchema).optional()
}).strict();
export const NestedEnumKycStatusWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumKycStatusWithAggregatesFilter> = nestedenumkycstatuswithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumKycStatusWithAggregatesFilter>;
export const NestedEnumKycStatusWithAggregatesFilterObjectZodSchema = nestedenumkycstatuswithaggregatesfilterSchema;
