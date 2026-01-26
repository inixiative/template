import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateWithoutOrganizationInputObjectSchema as OrganizationUserUpdateWithoutOrganizationInputObjectSchema } from './OrganizationUserUpdateWithoutOrganizationInput.schema';
import { OrganizationUserUncheckedUpdateWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedUpdateWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutOrganizationInput.schema';
import { OrganizationUserCreateWithoutOrganizationInputObjectSchema as OrganizationUserCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateWithoutOrganizationInput.schema';
import { OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => OrganizationUserUpdateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutOrganizationInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema)])
}).strict();
export const OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInput>;
export const OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInputObjectZodSchema = makeSchema();
