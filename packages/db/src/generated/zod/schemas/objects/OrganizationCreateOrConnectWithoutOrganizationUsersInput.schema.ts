import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationCreateWithoutOrganizationUsersInputObjectSchema as OrganizationCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedCreateWithoutOrganizationUsersInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema)])
}).strict();
export const OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutOrganizationUsersInput>;
export const OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
