import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationCreateManyInputObjectSchema as OrganizationCreateManyInputObjectSchema } from './objects/OrganizationCreateManyInput.schema';

export const OrganizationCreateManyAndReturnSchema: z.ZodType<Prisma.OrganizationCreateManyAndReturnArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), data: z.union([ OrganizationCreateManyInputObjectSchema, z.array(OrganizationCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationCreateManyAndReturnArgs>;

export const OrganizationCreateManyAndReturnZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), data: z.union([ OrganizationCreateManyInputObjectSchema, z.array(OrganizationCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();