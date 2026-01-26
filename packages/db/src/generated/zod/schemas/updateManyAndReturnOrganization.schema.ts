import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './objects/OrganizationSelect.schema';
import { OrganizationUpdateManyMutationInputObjectSchema as OrganizationUpdateManyMutationInputObjectSchema } from './objects/OrganizationUpdateManyMutationInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './objects/OrganizationWhereInput.schema';

export const OrganizationUpdateManyAndReturnSchema: z.ZodType<Prisma.OrganizationUpdateManyAndReturnArgs> = z.object({ select: OrganizationSelectObjectSchema.optional(), data: OrganizationUpdateManyMutationInputObjectSchema, where: OrganizationWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUpdateManyAndReturnArgs>;

export const OrganizationUpdateManyAndReturnZodSchema = z.object({ select: OrganizationSelectObjectSchema.optional(), data: OrganizationUpdateManyMutationInputObjectSchema, where: OrganizationWhereInputObjectSchema.optional() }).strict();