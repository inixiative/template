import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutOrganizationsInputObjectSchema as UserUpdateWithoutOrganizationsInputObjectSchema } from './UserUpdateWithoutOrganizationsInput.schema';
import { UserUncheckedUpdateWithoutOrganizationsInputObjectSchema as UserUncheckedUpdateWithoutOrganizationsInputObjectSchema } from './UserUncheckedUpdateWithoutOrganizationsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutOrganizationsInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutOrganizationsInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutOrganizationsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutOrganizationsInput>;
export const UserUpdateToOneWithWhereWithoutOrganizationsInputObjectZodSchema = makeSchema();
