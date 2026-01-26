import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCreateWithoutOrganizationUsersInputObjectSchema as OrganizationCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedCreateWithoutOrganizationUsersInput.schema';
import { OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema as OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateOrConnectWithoutOrganizationUsersInput.schema';
import { OrganizationUpsertWithoutOrganizationUsersInputObjectSchema as OrganizationUpsertWithoutOrganizationUsersInputObjectSchema } from './OrganizationUpsertWithoutOrganizationUsersInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema as OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema } from './OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInput.schema';
import { OrganizationUpdateWithoutOrganizationUsersInputObjectSchema as OrganizationUpdateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUpdateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedUpdateWithoutOrganizationUsersInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutOrganizationUsersInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutOrganizationUsersInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutOrganizationUsersInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUpdateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema)]).optional()
}).strict();
export const OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInput>;
export const OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectZodSchema = makeSchema();
