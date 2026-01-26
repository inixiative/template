import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserCreateWithoutUserInputObjectSchema as OrganizationUserCreateWithoutUserInputObjectSchema } from './OrganizationUserCreateWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutUserInput.schema';
import { OrganizationUserCreateOrConnectWithoutUserInputObjectSchema as OrganizationUserCreateOrConnectWithoutUserInputObjectSchema } from './OrganizationUserCreateOrConnectWithoutUserInput.schema';
import { OrganizationUserCreateManyUserInputEnvelopeObjectSchema as OrganizationUserCreateManyUserInputEnvelopeObjectSchema } from './OrganizationUserCreateManyUserInputEnvelope.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserCreateWithoutUserInputObjectSchema).array(), z.lazy(() => OrganizationUserUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => OrganizationUserCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => OrganizationUserCreateManyUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema: z.ZodType<Prisma.OrganizationUserUncheckedCreateNestedManyWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUncheckedCreateNestedManyWithoutUserInput>;
export const OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectZodSchema = makeSchema();
