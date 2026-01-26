import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCreateWithoutOrganizationUsersInputObjectSchema as OrganizationCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedCreateWithoutOrganizationUsersInput.schema';
import { OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema as OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateOrConnectWithoutOrganizationUsersInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutOrganizationUsersInput>;
export const OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
