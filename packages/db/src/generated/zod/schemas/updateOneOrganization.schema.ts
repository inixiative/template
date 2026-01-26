import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationUpdateInputObjectSchema as OrganizationUpdateInputObjectSchema } from './objects/OrganizationUpdateInput.schema';
import { OrganizationUncheckedUpdateInputObjectSchema as OrganizationUncheckedUpdateInputObjectSchema } from './objects/OrganizationUncheckedUpdateInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';

export const OrganizationUpdateOneSchema: z.ZodType<Prisma.OrganizationUpdateArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), data: z.union([OrganizationUpdateInputObjectSchema, OrganizationUncheckedUpdateInputObjectSchema]), where: OrganizationWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationUpdateArgs>;

export const OrganizationUpdateOneZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), data: z.union([OrganizationUpdateInputObjectSchema, OrganizationUncheckedUpdateInputObjectSchema]), where: OrganizationWhereUniqueInputObjectSchema }).strict();