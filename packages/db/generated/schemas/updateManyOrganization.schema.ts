import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationUpdateManyMutationInputObjectSchema as OrganizationUpdateManyMutationInputObjectSchema } from './objects/OrganizationUpdateManyMutationInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './objects/OrganizationWhereInput.schema';

export const OrganizationUpdateManySchema: z.ZodType<Prisma.OrganizationUpdateManyArgs> = z.object({ data: OrganizationUpdateManyMutationInputObjectSchema, where: OrganizationWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUpdateManyArgs>;

export const OrganizationUpdateManyZodSchema = z.object({ data: OrganizationUpdateManyMutationInputObjectSchema, where: OrganizationWhereInputObjectSchema.optional() }).strict();