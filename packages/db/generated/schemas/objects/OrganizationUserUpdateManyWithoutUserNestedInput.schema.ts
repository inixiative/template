import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserCreateWithoutUserInputObjectSchema as OrganizationUserCreateWithoutUserInputObjectSchema } from './OrganizationUserCreateWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutUserInput.schema';
import { OrganizationUserCreateOrConnectWithoutUserInputObjectSchema as OrganizationUserCreateOrConnectWithoutUserInputObjectSchema } from './OrganizationUserCreateOrConnectWithoutUserInput.schema';
import { OrganizationUserUpsertWithWhereUniqueWithoutUserInputObjectSchema as OrganizationUserUpsertWithWhereUniqueWithoutUserInputObjectSchema } from './OrganizationUserUpsertWithWhereUniqueWithoutUserInput.schema';
import { OrganizationUserCreateManyUserInputEnvelopeObjectSchema as OrganizationUserCreateManyUserInputEnvelopeObjectSchema } from './OrganizationUserCreateManyUserInputEnvelope.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateWithWhereUniqueWithoutUserInputObjectSchema as OrganizationUserUpdateWithWhereUniqueWithoutUserInputObjectSchema } from './OrganizationUserUpdateWithWhereUniqueWithoutUserInput.schema';
import { OrganizationUserUpdateManyWithWhereWithoutUserInputObjectSchema as OrganizationUserUpdateManyWithWhereWithoutUserInputObjectSchema } from './OrganizationUserUpdateManyWithWhereWithoutUserInput.schema';
import { OrganizationUserScalarWhereInputObjectSchema as OrganizationUserScalarWhereInputObjectSchema } from './OrganizationUserScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserCreateWithoutUserInputObjectSchema).array(), z.lazy(() => OrganizationUserUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => OrganizationUserCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => OrganizationUserUpsertWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUpsertWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => OrganizationUserCreateManyUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => OrganizationUserUpdateWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUpdateWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => OrganizationUserUpdateManyWithWhereWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUpdateManyWithWhereWithoutUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => OrganizationUserScalarWhereInputObjectSchema), z.lazy(() => OrganizationUserScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const OrganizationUserUpdateManyWithoutUserNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateManyWithoutUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateManyWithoutUserNestedInput>;
export const OrganizationUserUpdateManyWithoutUserNestedInputObjectZodSchema = makeSchema();
