import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  is: z.lazy(() => UserWhereInputObjectSchema).optional().nullable(),
  isNot: z.lazy(() => UserWhereInputObjectSchema).optional().nullable()
}).strict();
export const UserNullableScalarRelationFilterObjectSchema: z.ZodType<Prisma.UserNullableScalarRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.UserNullableScalarRelationFilter>;
export const UserNullableScalarRelationFilterObjectZodSchema = makeSchema();
