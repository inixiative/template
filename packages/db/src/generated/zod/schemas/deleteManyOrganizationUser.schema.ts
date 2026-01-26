import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './objects/OrganizationUserWhereInput.schema';

export const OrganizationUserDeleteManySchema: z.ZodType<Prisma.OrganizationUserDeleteManyArgs> = z.object({ where: OrganizationUserWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUserDeleteManyArgs>;

export const OrganizationUserDeleteManyZodSchema = z.object({ where: OrganizationUserWhereInputObjectSchema.optional() }).strict();