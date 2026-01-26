import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';

export const OrganizationDeleteOneSchema: z.ZodType<Prisma.OrganizationDeleteArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationDeleteArgs>;

export const OrganizationDeleteOneZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema }).strict();