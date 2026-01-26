import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUpdateWithoutUsersInputObjectSchema as OrganizationUpdateWithoutUsersInputObjectSchema } from './OrganizationUpdateWithoutUsersInput.schema';
import { OrganizationUncheckedUpdateWithoutUsersInputObjectSchema as OrganizationUncheckedUpdateWithoutUsersInputObjectSchema } from './OrganizationUncheckedUpdateWithoutUsersInput.schema';
import { OrganizationCreateWithoutUsersInputObjectSchema as OrganizationCreateWithoutUsersInputObjectSchema } from './OrganizationCreateWithoutUsersInput.schema';
import { OrganizationUncheckedCreateWithoutUsersInputObjectSchema as OrganizationUncheckedCreateWithoutUsersInputObjectSchema } from './OrganizationUncheckedCreateWithoutUsersInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUpdateWithoutUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutUsersInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationCreateWithoutUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutUsersInputObjectSchema)]),
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUpsertWithoutUsersInputObjectSchema: z.ZodType<Prisma.OrganizationUpsertWithoutUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpsertWithoutUsersInput>;
export const OrganizationUpsertWithoutUsersInputObjectZodSchema = makeSchema();
