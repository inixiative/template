import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUpdateWithoutUsersInputObjectSchema as OrganizationUpdateWithoutUsersInputObjectSchema } from './OrganizationUpdateWithoutUsersInput.schema';
import { OrganizationUncheckedUpdateWithoutUsersInputObjectSchema as OrganizationUncheckedUpdateWithoutUsersInputObjectSchema } from './OrganizationUncheckedUpdateWithoutUsersInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUpdateWithoutUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutUsersInputObjectSchema)])
}).strict();
export const OrganizationUpdateToOneWithWhereWithoutUsersInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutUsersInput>;
export const OrganizationUpdateToOneWithWhereWithoutUsersInputObjectZodSchema = makeSchema();
