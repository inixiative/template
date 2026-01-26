import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './objects/OrganizationUserInclude.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './objects/OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserCreateInputObjectSchema as OrganizationUserCreateInputObjectSchema } from './objects/OrganizationUserCreateInput.schema';
import { OrganizationUserUncheckedCreateInputObjectSchema as OrganizationUserUncheckedCreateInputObjectSchema } from './objects/OrganizationUserUncheckedCreateInput.schema';
import { OrganizationUserUpdateInputObjectSchema as OrganizationUserUpdateInputObjectSchema } from './objects/OrganizationUserUpdateInput.schema';
import { OrganizationUserUncheckedUpdateInputObjectSchema as OrganizationUserUncheckedUpdateInputObjectSchema } from './objects/OrganizationUserUncheckedUpdateInput.schema';

export const OrganizationUserUpsertOneSchema: z.ZodType<Prisma.OrganizationUserUpsertArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), where: OrganizationUserWhereUniqueInputObjectSchema, create: z.union([ OrganizationUserCreateInputObjectSchema, OrganizationUserUncheckedCreateInputObjectSchema ]), update: z.union([ OrganizationUserUpdateInputObjectSchema, OrganizationUserUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.OrganizationUserUpsertArgs>;

export const OrganizationUserUpsertOneZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), where: OrganizationUserWhereUniqueInputObjectSchema, create: z.union([ OrganizationUserCreateInputObjectSchema, OrganizationUserUncheckedCreateInputObjectSchema ]), update: z.union([ OrganizationUserUpdateInputObjectSchema, OrganizationUserUncheckedUpdateInputObjectSchema ]) }).strict();