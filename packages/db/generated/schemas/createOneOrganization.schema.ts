import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationCreateInputObjectSchema as OrganizationCreateInputObjectSchema } from './objects/OrganizationCreateInput.schema';
import { OrganizationUncheckedCreateInputObjectSchema as OrganizationUncheckedCreateInputObjectSchema } from './objects/OrganizationUncheckedCreateInput.schema';

export const OrganizationCreateOneSchema: z.ZodType<Prisma.OrganizationCreateArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), data: z.union([OrganizationCreateInputObjectSchema, OrganizationUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.OrganizationCreateArgs>;

export const OrganizationCreateOneZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), include: OrganizationIncludeObjectSchema.optional(), data: z.union([OrganizationCreateInputObjectSchema, OrganizationUncheckedCreateInputObjectSchema]) }).strict();