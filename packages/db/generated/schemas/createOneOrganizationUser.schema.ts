import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './objects/OrganizationUserInclude.schema';
import { OrganizationUserCreateInputObjectSchema as OrganizationUserCreateInputObjectSchema } from './objects/OrganizationUserCreateInput.schema';
import { OrganizationUserUncheckedCreateInputObjectSchema as OrganizationUserUncheckedCreateInputObjectSchema } from './objects/OrganizationUserUncheckedCreateInput.schema';

export const OrganizationUserCreateOneSchema: z.ZodType<Prisma.OrganizationUserCreateArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), data: z.union([OrganizationUserCreateInputObjectSchema, OrganizationUserUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.OrganizationUserCreateArgs>;

export const OrganizationUserCreateOneZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), data: z.union([OrganizationUserCreateInputObjectSchema, OrganizationUserUncheckedCreateInputObjectSchema]) }).strict();