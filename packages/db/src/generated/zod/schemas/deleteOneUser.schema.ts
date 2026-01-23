import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './objects/UserWhereUniqueInput.schema';

export const UserDeleteOneSchema: z.ZodType<Prisma.UserDeleteArgs> = z.object({   where: UserWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.UserDeleteArgs>;

export const UserDeleteOneZodSchema = z.object({   where: UserWhereUniqueInputObjectSchema }).strict();