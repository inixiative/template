import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { NestedEnumTokenOwnerModelFilterObjectSchema as NestedEnumTokenOwnerModelFilterObjectSchema } from './NestedEnumTokenOwnerModelFilter.schema'

const makeSchema = () => z.object({
  equals: TokenOwnerModelSchema.optional(),
  in: TokenOwnerModelSchema.array().optional(),
  notIn: TokenOwnerModelSchema.array().optional(),
  not: z.union([TokenOwnerModelSchema, z.lazy(() => NestedEnumTokenOwnerModelFilterObjectSchema)]).optional()
}).strict();
export const EnumTokenOwnerModelFilterObjectSchema: z.ZodType<Prisma.EnumTokenOwnerModelFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumTokenOwnerModelFilter>;
export const EnumTokenOwnerModelFilterObjectZodSchema = makeSchema();
