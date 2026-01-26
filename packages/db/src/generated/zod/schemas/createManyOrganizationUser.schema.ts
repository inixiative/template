import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationUserCreateManyInputObjectSchema as OrganizationUserCreateManyInputObjectSchema } from './objects/OrganizationUserCreateManyInput.schema';

export const OrganizationUserCreateManySchema: z.ZodType<Prisma.OrganizationUserCreateManyArgs> = z.object({ data: z.union([ OrganizationUserCreateManyInputObjectSchema, z.array(OrganizationUserCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUserCreateManyArgs>;

export const OrganizationUserCreateManyZodSchema = z.object({ data: z.union([ OrganizationUserCreateManyInputObjectSchema, z.array(OrganizationUserCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();