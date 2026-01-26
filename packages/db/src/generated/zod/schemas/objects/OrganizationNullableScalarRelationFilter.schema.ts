import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  is: z.lazy(() => OrganizationWhereInputObjectSchema).optional().nullable(),
  isNot: z.lazy(() => OrganizationWhereInputObjectSchema).optional().nullable()
}).strict();
export const OrganizationNullableScalarRelationFilterObjectSchema: z.ZodType<Prisma.OrganizationNullableScalarRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationNullableScalarRelationFilter>;
export const OrganizationNullableScalarRelationFilterObjectZodSchema = makeSchema();
