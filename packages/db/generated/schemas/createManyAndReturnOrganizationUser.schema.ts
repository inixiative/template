import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserCreateManyInputObjectSchema as OrganizationUserCreateManyInputObjectSchema } from './objects/OrganizationUserCreateManyInput.schema';

export const OrganizationUserCreateManyAndReturnSchema: z.ZodType<Prisma.OrganizationUserCreateManyAndReturnArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), data: z.union([ OrganizationUserCreateManyInputObjectSchema, z.array(OrganizationUserCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUserCreateManyAndReturnArgs>;

export const OrganizationUserCreateManyAndReturnZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), data: z.union([ OrganizationUserCreateManyInputObjectSchema, z.array(OrganizationUserCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();