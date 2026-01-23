import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema'

const nestedenumkycstatusfilterSchema = z.object({
  equals: KycStatusSchema.optional(),
  in: KycStatusSchema.array().optional(),
  notIn: KycStatusSchema.array().optional(),
  not: z.union([KycStatusSchema, z.lazy(() => NestedEnumKycStatusFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumKycStatusFilterObjectSchema: z.ZodType<Prisma.NestedEnumKycStatusFilter> = nestedenumkycstatusfilterSchema as unknown as z.ZodType<Prisma.NestedEnumKycStatusFilter>;
export const NestedEnumKycStatusFilterObjectZodSchema = nestedenumkycstatusfilterSchema;
