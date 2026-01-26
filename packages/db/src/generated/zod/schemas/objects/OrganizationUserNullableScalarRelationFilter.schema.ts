import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema'

const makeSchema = () => z.object({
  is: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional().nullable(),
  isNot: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional().nullable()
}).strict();
export const OrganizationUserNullableScalarRelationFilterObjectSchema: z.ZodType<Prisma.OrganizationUserNullableScalarRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserNullableScalarRelationFilter>;
export const OrganizationUserNullableScalarRelationFilterObjectZodSchema = makeSchema();
