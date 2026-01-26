import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationCreateManyInputObjectSchema as OrganizationCreateManyInputObjectSchema } from './objects/OrganizationCreateManyInput.schema';

export const OrganizationCreateManySchema: z.ZodType<Prisma.OrganizationCreateManyArgs> = z.object({ data: z.union([ OrganizationCreateManyInputObjectSchema, z.array(OrganizationCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationCreateManyArgs>;

export const OrganizationCreateManyZodSchema = z.object({ data: z.union([ OrganizationCreateManyInputObjectSchema, z.array(OrganizationCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();