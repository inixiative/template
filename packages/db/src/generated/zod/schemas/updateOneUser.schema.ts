import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserUpdateInputObjectSchema as UserUpdateInputObjectSchema } from './objects/UserUpdateInput.schema';
import { UserUncheckedUpdateInputObjectSchema as UserUncheckedUpdateInputObjectSchema } from './objects/UserUncheckedUpdateInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './objects/UserWhereUniqueInput.schema';

export const UserUpdateOneSchema: z.ZodType<Prisma.UserUpdateArgs> = z.object({   data: z.union([UserUpdateInputObjectSchema, UserUncheckedUpdateInputObjectSchema]), where: UserWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.UserUpdateArgs>;

export const UserUpdateOneZodSchema = z.object({   data: z.union([UserUpdateInputObjectSchema, UserUncheckedUpdateInputObjectSchema]), where: UserWhereUniqueInputObjectSchema }).strict();