import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';

export const OrganizationFindUniqueOrThrowSchema: z.ZodType<Prisma.OrganizationFindUniqueOrThrowArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationFindUniqueOrThrowArgs>;

export const OrganizationFindUniqueOrThrowZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema }).strict();