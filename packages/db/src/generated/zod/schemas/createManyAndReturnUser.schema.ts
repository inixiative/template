import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserCreateManyInputObjectSchema as UserCreateManyInputObjectSchema } from './objects/UserCreateManyInput.schema';

export const UserCreateManyAndReturnSchema: z.ZodType<Prisma.UserCreateManyAndReturnArgs> = z.object({  data: z.union([ UserCreateManyInputObjectSchema, z.array(UserCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.UserCreateManyAndReturnArgs>;

export const UserCreateManyAndReturnZodSchema = z.object({  data: z.union([ UserCreateManyInputObjectSchema, z.array(UserCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();