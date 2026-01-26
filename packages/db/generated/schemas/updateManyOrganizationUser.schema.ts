import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationUserUpdateManyMutationInputObjectSchema as OrganizationUserUpdateManyMutationInputObjectSchema } from './objects/OrganizationUserUpdateManyMutationInput.schema';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './objects/OrganizationUserWhereInput.schema';

export const OrganizationUserUpdateManySchema: z.ZodType<Prisma.OrganizationUserUpdateManyArgs> = z.object({ data: OrganizationUserUpdateManyMutationInputObjectSchema, where: OrganizationUserWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUserUpdateManyArgs>;

export const OrganizationUserUpdateManyZodSchema = z.object({ data: OrganizationUserUpdateManyMutationInputObjectSchema, where: OrganizationUserWhereInputObjectSchema.optional() }).strict();