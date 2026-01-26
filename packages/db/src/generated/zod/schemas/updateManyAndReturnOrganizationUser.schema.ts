import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './objects/OrganizationUserSelect.schema';
import { OrganizationUserUpdateManyMutationInputObjectSchema as OrganizationUserUpdateManyMutationInputObjectSchema } from './objects/OrganizationUserUpdateManyMutationInput.schema';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './objects/OrganizationUserWhereInput.schema';

export const OrganizationUserUpdateManyAndReturnSchema: z.ZodType<Prisma.OrganizationUserUpdateManyAndReturnArgs> = z.object({ select: OrganizationUserSelectObjectSchema.optional(), data: OrganizationUserUpdateManyMutationInputObjectSchema, where: OrganizationUserWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUserUpdateManyAndReturnArgs>;

export const OrganizationUserUpdateManyAndReturnZodSchema = z.object({ select: OrganizationUserSelectObjectSchema.optional(), data: OrganizationUserUpdateManyMutationInputObjectSchema, where: OrganizationUserWhereInputObjectSchema.optional() }).strict();