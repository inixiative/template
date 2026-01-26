import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateWithoutOrganizationUserInputObjectSchema as TokenCreateWithoutOrganizationUserInputObjectSchema } from './TokenCreateWithoutOrganizationUserInput.schema';
import { TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema as TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationUserInput.schema';
import { TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema as TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema } from './TokenCreateOrConnectWithoutOrganizationUserInput.schema';
import { TokenCreateManyOrganizationUserInputEnvelopeObjectSchema as TokenCreateManyOrganizationUserInputEnvelopeObjectSchema } from './TokenCreateManyOrganizationUserInputEnvelope.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenCreateWithoutOrganizationUserInputObjectSchema).array(), z.lazy(() => TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => TokenCreateManyOrganizationUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema: z.ZodType<Prisma.TokenUncheckedCreateNestedManyWithoutOrganizationUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUncheckedCreateNestedManyWithoutOrganizationUserInput>;
export const TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectZodSchema = makeSchema();
