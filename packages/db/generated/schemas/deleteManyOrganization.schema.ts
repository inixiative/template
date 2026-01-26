import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './objects/OrganizationWhereInput.schema';

export const OrganizationDeleteManySchema: z.ZodType<Prisma.OrganizationDeleteManyArgs> = z.object({ where: OrganizationWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationDeleteManyArgs>;

export const OrganizationDeleteManyZodSchema = z.object({ where: OrganizationWhereInputObjectSchema.optional() }).strict();