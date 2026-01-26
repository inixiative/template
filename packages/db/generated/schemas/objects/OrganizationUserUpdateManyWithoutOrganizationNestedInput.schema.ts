import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserCreateWithoutOrganizationInputObjectSchema as OrganizationUserCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateWithoutOrganizationInput.schema';
import { OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutOrganizationInput.schema';
import { OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema as OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateOrConnectWithoutOrganizationInput.schema';
import { OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema as OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema } from './OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInput.schema';
import { OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema as OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema } from './OrganizationUserCreateManyOrganizationInputEnvelope.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema as OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema } from './OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInput.schema';
import { OrganizationUserUpdateManyWithWhereWithoutOrganizationInputObjectSchema as OrganizationUserUpdateManyWithWhereWithoutOrganizationInputObjectSchema } from './OrganizationUserUpdateManyWithWhereWithoutOrganizationInput.schema';
import { OrganizationUserScalarWhereInputObjectSchema as OrganizationUserScalarWhereInputObjectSchema } from './OrganizationUserScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserCreateWithoutOrganizationInputObjectSchema).array(), z.lazy(() => OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => OrganizationUserUpdateManyWithWhereWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUpdateManyWithWhereWithoutOrganizationInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => OrganizationUserScalarWhereInputObjectSchema), z.lazy(() => OrganizationUserScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateManyWithoutOrganizationNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateManyWithoutOrganizationNestedInput>;
export const OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectZodSchema = makeSchema();
