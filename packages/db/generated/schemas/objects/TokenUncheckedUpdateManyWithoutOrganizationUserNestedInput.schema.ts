import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateWithoutOrganizationUserInputObjectSchema as TokenCreateWithoutOrganizationUserInputObjectSchema } from './TokenCreateWithoutOrganizationUserInput.schema';
import { TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema as TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationUserInput.schema';
import { TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema as TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema } from './TokenCreateOrConnectWithoutOrganizationUserInput.schema';
import { TokenUpsertWithWhereUniqueWithoutOrganizationUserInputObjectSchema as TokenUpsertWithWhereUniqueWithoutOrganizationUserInputObjectSchema } from './TokenUpsertWithWhereUniqueWithoutOrganizationUserInput.schema';
import { TokenCreateManyOrganizationUserInputEnvelopeObjectSchema as TokenCreateManyOrganizationUserInputEnvelopeObjectSchema } from './TokenCreateManyOrganizationUserInputEnvelope.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithWhereUniqueWithoutOrganizationUserInputObjectSchema as TokenUpdateWithWhereUniqueWithoutOrganizationUserInputObjectSchema } from './TokenUpdateWithWhereUniqueWithoutOrganizationUserInput.schema';
import { TokenUpdateManyWithWhereWithoutOrganizationUserInputObjectSchema as TokenUpdateManyWithWhereWithoutOrganizationUserInputObjectSchema } from './TokenUpdateManyWithWhereWithoutOrganizationUserInput.schema';
import { TokenScalarWhereInputObjectSchema as TokenScalarWhereInputObjectSchema } from './TokenScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenCreateWithoutOrganizationUserInputObjectSchema).array(), z.lazy(() => TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => TokenUpsertWithWhereUniqueWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUpsertWithWhereUniqueWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => TokenCreateManyOrganizationUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => TokenUpdateWithWhereUniqueWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUpdateWithWhereUniqueWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => TokenUpdateManyWithWhereWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUpdateManyWithWhereWithoutOrganizationUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => TokenScalarWhereInputObjectSchema), z.lazy(() => TokenScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const TokenUncheckedUpdateManyWithoutOrganizationUserNestedInputObjectSchema: z.ZodType<Prisma.TokenUncheckedUpdateManyWithoutOrganizationUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUncheckedUpdateManyWithoutOrganizationUserNestedInput>;
export const TokenUncheckedUpdateManyWithoutOrganizationUserNestedInputObjectZodSchema = makeSchema();
