import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserCreateInputObjectSchema as UserCreateInputObjectSchema } from './objects/UserCreateInput.schema';
import { UserUncheckedCreateInputObjectSchema as UserUncheckedCreateInputObjectSchema } from './objects/UserUncheckedCreateInput.schema';

export const UserCreateOneSchema: z.ZodType<Prisma.UserCreateArgs> = z.object({   data: z.union([UserCreateInputObjectSchema, UserUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.UserCreateArgs>;

export const UserCreateOneZodSchema = z.object({   data: z.union([UserCreateInputObjectSchema, UserUncheckedCreateInputObjectSchema]) }).strict();