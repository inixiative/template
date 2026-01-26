import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';
import { OrganizationCreateInputObjectSchema as OrganizationCreateInputObjectSchema } from './objects/OrganizationCreateInput.schema';
import { OrganizationUncheckedCreateInputObjectSchema as OrganizationUncheckedCreateInputObjectSchema } from './objects/OrganizationUncheckedCreateInput.schema';
import { OrganizationUpdateInputObjectSchema as OrganizationUpdateInputObjectSchema } from './objects/OrganizationUpdateInput.schema';
import { OrganizationUncheckedUpdateInputObjectSchema as OrganizationUncheckedUpdateInputObjectSchema } from './objects/OrganizationUncheckedUpdateInput.schema';

export const OrganizationUpsertOneSchema: z.ZodType<Prisma.OrganizationUpsertArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema, create: z.union([ OrganizationCreateInputObjectSchema, OrganizationUncheckedCreateInputObjectSchema ]), update: z.union([ OrganizationUpdateInputObjectSchema, OrganizationUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.OrganizationUpsertArgs>;

export const OrganizationUpsertOneZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), where: OrganizationWhereUniqueInputObjectSchema, create: z.union([ OrganizationCreateInputObjectSchema, OrganizationUncheckedCreateInputObjectSchema ]), update: z.union([ OrganizationUpdateInputObjectSchema, OrganizationUncheckedUpdateInputObjectSchema ]) }).strict();