import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateWithoutUserInputObjectSchema as OrganizationUserUpdateWithoutUserInputObjectSchema } from './OrganizationUserUpdateWithoutUserInput.schema';
import { OrganizationUserUncheckedUpdateWithoutUserInputObjectSchema as OrganizationUserUncheckedUpdateWithoutUserInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutUserInput.schema';
import { OrganizationUserCreateWithoutUserInputObjectSchema as OrganizationUserCreateWithoutUserInputObjectSchema } from './OrganizationUserCreateWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => OrganizationUserUpdateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutUserInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const OrganizationUserUpsertWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpsertWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpsertWithWhereUniqueWithoutUserInput>;
export const OrganizationUserUpsertWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
