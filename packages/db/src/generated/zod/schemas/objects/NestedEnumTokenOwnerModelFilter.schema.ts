import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema'

const nestedenumtokenownermodelfilterSchema = z.object({
  equals: TokenOwnerModelSchema.optional(),
  in: TokenOwnerModelSchema.array().optional(),
  notIn: TokenOwnerModelSchema.array().optional(),
  not: z.union([TokenOwnerModelSchema, z.lazy(() => NestedEnumTokenOwnerModelFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumTokenOwnerModelFilterObjectSchema: z.ZodType<Prisma.NestedEnumTokenOwnerModelFilter> = nestedenumtokenownermodelfilterSchema as unknown as z.ZodType<Prisma.NestedEnumTokenOwnerModelFilter>;
export const NestedEnumTokenOwnerModelFilterObjectZodSchema = nestedenumtokenownermodelfilterSchema;
