import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './objects/UserWhereUniqueInput.schema';
import { UserCreateInputObjectSchema as UserCreateInputObjectSchema } from './objects/UserCreateInput.schema';
import { UserUncheckedCreateInputObjectSchema as UserUncheckedCreateInputObjectSchema } from './objects/UserUncheckedCreateInput.schema';
import { UserUpdateInputObjectSchema as UserUpdateInputObjectSchema } from './objects/UserUpdateInput.schema';
import { UserUncheckedUpdateInputObjectSchema as UserUncheckedUpdateInputObjectSchema } from './objects/UserUncheckedUpdateInput.schema';

export const UserUpsertOneSchema: z.ZodType<Prisma.UserUpsertArgs> = z.object({   where: UserWhereUniqueInputObjectSchema, create: z.union([ UserCreateInputObjectSchema, UserUncheckedCreateInputObjectSchema ]), update: z.union([ UserUpdateInputObjectSchema, UserUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.UserUpsertArgs>;

export const UserUpsertOneZodSchema = z.object({   where: UserWhereUniqueInputObjectSchema, create: z.union([ UserCreateInputObjectSchema, UserUncheckedCreateInputObjectSchema ]), update: z.union([ UserUpdateInputObjectSchema, UserUncheckedUpdateInputObjectSchema ]) }).strict();