import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserCreateWithoutOrganizationInputObjectSchema as OrganizationUserCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateWithoutOrganizationInput.schema';
import { OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutOrganizationInput.schema';
import { OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema as OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateOrConnectWithoutOrganizationInput.schema';
import { OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema as OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema } from './OrganizationUserCreateManyOrganizationInputEnvelope.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserCreateWithoutOrganizationInputObjectSchema).array(), z.lazy(() => OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema), z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const OrganizationUserCreateNestedManyWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateNestedManyWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateNestedManyWithoutOrganizationInput>;
export const OrganizationUserCreateNestedManyWithoutOrganizationInputObjectZodSchema = makeSchema();
