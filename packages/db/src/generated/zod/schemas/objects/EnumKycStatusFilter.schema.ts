import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema';
import { NestedEnumKycStatusFilterObjectSchema as NestedEnumKycStatusFilterObjectSchema } from './NestedEnumKycStatusFilter.schema'

const makeSchema = () => z.object({
  equals: KycStatusSchema.optional(),
  in: KycStatusSchema.array().optional(),
  notIn: KycStatusSchema.array().optional(),
  not: z.union([KycStatusSchema, z.lazy(() => NestedEnumKycStatusFilterObjectSchema)]).optional()
}).strict();
export const EnumKycStatusFilterObjectSchema: z.ZodType<Prisma.EnumKycStatusFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumKycStatusFilter>;
export const EnumKycStatusFilterObjectZodSchema = makeSchema();
