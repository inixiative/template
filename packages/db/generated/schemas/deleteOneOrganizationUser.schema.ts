import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './objects/OrganizationUserInclude.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './objects/OrganizationUserWhereUniqueInput.schema';

export const OrganizationUserDeleteOneSchema: z.ZodType<Prisma.OrganizationUserDeleteArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), where: OrganizationUserWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationUserDeleteArgs>;

export const OrganizationUserDeleteOneZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), where: OrganizationUserWhereUniqueInputObjectSchema }).strict();