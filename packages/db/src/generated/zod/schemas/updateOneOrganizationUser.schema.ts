import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './objects/OrganizationUserInclude.schema';
import { OrganizationUserUpdateInputObjectSchema as OrganizationUserUpdateInputObjectSchema } from './objects/OrganizationUserUpdateInput.schema';
import { OrganizationUserUncheckedUpdateInputObjectSchema as OrganizationUserUncheckedUpdateInputObjectSchema } from './objects/OrganizationUserUncheckedUpdateInput.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './objects/OrganizationUserWhereUniqueInput.schema';

export const OrganizationUserUpdateOneSchema: z.ZodType<Prisma.OrganizationUserUpdateArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), data: z.union([OrganizationUserUpdateInputObjectSchema, OrganizationUserUncheckedUpdateInputObjectSchema]), where: OrganizationUserWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationUserUpdateArgs>;

export const OrganizationUserUpdateOneZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), data: z.union([OrganizationUserUpdateInputObjectSchema, OrganizationUserUncheckedUpdateInputObjectSchema]), where: OrganizationUserWhereUniqueInputObjectSchema }).strict();