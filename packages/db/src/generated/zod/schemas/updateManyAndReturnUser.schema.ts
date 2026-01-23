import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserUpdateManyMutationInputObjectSchema as UserUpdateManyMutationInputObjectSchema } from './objects/UserUpdateManyMutationInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './objects/UserWhereInput.schema';

export const UserUpdateManyAndReturnSchema: z.ZodType<Prisma.UserUpdateManyAndReturnArgs> = z.object({  data: UserUpdateManyMutationInputObjectSchema, where: UserWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.UserUpdateManyAndReturnArgs>;

export const UserUpdateManyAndReturnZodSchema = z.object({  data: UserUpdateManyMutationInputObjectSchema, where: UserWhereInputObjectSchema.optional() }).strict();