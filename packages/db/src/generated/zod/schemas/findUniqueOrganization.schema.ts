import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';

export const OrganizationFindUniqueSchema: z.ZodType<Prisma.OrganizationFindUniqueArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationFindUniqueArgs>;

export const OrganizationFindUniqueZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema }).strict();