import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './objects/OrganizationUserInclude.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './objects/OrganizationUserWhereUniqueInput.schema';

export const OrganizationUserFindUniqueOrThrowSchema: z.ZodType<Prisma.OrganizationUserFindUniqueOrThrowArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), where: OrganizationUserWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.OrganizationUserFindUniqueOrThrowArgs>;

export const OrganizationUserFindUniqueOrThrowZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), include: OrganizationUserIncludeObjectSchema.optional(), where: OrganizationUserWhereUniqueInputObjectSchema }).strict();