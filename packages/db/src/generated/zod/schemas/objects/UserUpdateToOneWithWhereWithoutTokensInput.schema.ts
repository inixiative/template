import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutTokensInputObjectSchema as UserUpdateWithoutTokensInputObjectSchema } from './UserUpdateWithoutTokensInput.schema';
import { UserUncheckedUpdateWithoutTokensInputObjectSchema as UserUncheckedUpdateWithoutTokensInputObjectSchema } from './UserUncheckedUpdateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutTokensInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutTokensInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutTokensInput>;
export const UserUpdateToOneWithWhereWithoutTokensInputObjectZodSchema = makeSchema();
