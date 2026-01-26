import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  is: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  isNot: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationScalarRelationFilterObjectSchema: z.ZodType<Prisma.OrganizationScalarRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationScalarRelationFilter>;
export const OrganizationScalarRelationFilterObjectZodSchema = makeSchema();
