import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional(),
  some: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional(),
  none: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUserListRelationFilterObjectSchema: z.ZodType<Prisma.OrganizationUserListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserListRelationFilter>;
export const OrganizationUserListRelationFilterObjectZodSchema = makeSchema();
