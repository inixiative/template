import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUpdateWithoutOrganizationUsersInputObjectSchema as OrganizationUpdateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUpdateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedUpdateWithoutOrganizationUsersInput.schema';
import { OrganizationCreateWithoutOrganizationUsersInputObjectSchema as OrganizationCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedCreateWithoutOrganizationUsersInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUpdateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema)]),
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUpsertWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.OrganizationUpsertWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpsertWithoutOrganizationUsersInput>;
export const OrganizationUpsertWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
