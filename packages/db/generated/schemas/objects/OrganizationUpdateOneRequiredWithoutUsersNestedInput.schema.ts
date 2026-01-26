import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCreateWithoutUsersInputObjectSchema as OrganizationCreateWithoutUsersInputObjectSchema } from './OrganizationCreateWithoutUsersInput.schema';
import { OrganizationUncheckedCreateWithoutUsersInputObjectSchema as OrganizationUncheckedCreateWithoutUsersInputObjectSchema } from './OrganizationUncheckedCreateWithoutUsersInput.schema';
import { OrganizationCreateOrConnectWithoutUsersInputObjectSchema as OrganizationCreateOrConnectWithoutUsersInputObjectSchema } from './OrganizationCreateOrConnectWithoutUsersInput.schema';
import { OrganizationUpsertWithoutUsersInputObjectSchema as OrganizationUpsertWithoutUsersInputObjectSchema } from './OrganizationUpsertWithoutUsersInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationUpdateToOneWithWhereWithoutUsersInputObjectSchema as OrganizationUpdateToOneWithWhereWithoutUsersInputObjectSchema } from './OrganizationUpdateToOneWithWhereWithoutUsersInput.schema';
import { OrganizationUpdateWithoutUsersInputObjectSchema as OrganizationUpdateWithoutUsersInputObjectSchema } from './OrganizationUpdateWithoutUsersInput.schema';
import { OrganizationUncheckedUpdateWithoutUsersInputObjectSchema as OrganizationUncheckedUpdateWithoutUsersInputObjectSchema } from './OrganizationUncheckedUpdateWithoutUsersInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutUsersInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutUsersInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutUsersInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUpdateToOneWithWhereWithoutUsersInputObjectSchema), z.lazy(() => OrganizationUpdateWithoutUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutUsersInputObjectSchema)]).optional()
}).strict();
export const OrganizationUpdateOneRequiredWithoutUsersNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutUsersNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutUsersNestedInput>;
export const OrganizationUpdateOneRequiredWithoutUsersNestedInputObjectZodSchema = makeSchema();
