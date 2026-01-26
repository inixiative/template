import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateWithoutUserInputObjectSchema as TokenCreateWithoutUserInputObjectSchema } from './TokenCreateWithoutUserInput.schema';
import { TokenUncheckedCreateWithoutUserInputObjectSchema as TokenUncheckedCreateWithoutUserInputObjectSchema } from './TokenUncheckedCreateWithoutUserInput.schema';
import { TokenCreateOrConnectWithoutUserInputObjectSchema as TokenCreateOrConnectWithoutUserInputObjectSchema } from './TokenCreateOrConnectWithoutUserInput.schema';
import { TokenUpsertWithWhereUniqueWithoutUserInputObjectSchema as TokenUpsertWithWhereUniqueWithoutUserInputObjectSchema } from './TokenUpsertWithWhereUniqueWithoutUserInput.schema';
import { TokenCreateManyUserInputEnvelopeObjectSchema as TokenCreateManyUserInputEnvelopeObjectSchema } from './TokenCreateManyUserInputEnvelope.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithWhereUniqueWithoutUserInputObjectSchema as TokenUpdateWithWhereUniqueWithoutUserInputObjectSchema } from './TokenUpdateWithWhereUniqueWithoutUserInput.schema';
import { TokenUpdateManyWithWhereWithoutUserInputObjectSchema as TokenUpdateManyWithWhereWithoutUserInputObjectSchema } from './TokenUpdateManyWithWhereWithoutUserInput.schema';
import { TokenScalarWhereInputObjectSchema as TokenScalarWhereInputObjectSchema } from './TokenScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => TokenCreateWithoutUserInputObjectSchema), z.lazy(() => TokenCreateWithoutUserInputObjectSchema).array(), z.lazy(() => TokenUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => TokenCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => TokenCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => TokenUpsertWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => TokenUpsertWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => TokenCreateManyUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => TokenUpdateWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => TokenUpdateWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => TokenUpdateManyWithWhereWithoutUserInputObjectSchema), z.lazy(() => TokenUpdateManyWithWhereWithoutUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => TokenScalarWhereInputObjectSchema), z.lazy(() => TokenScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const TokenUpdateManyWithoutUserNestedInputObjectSchema: z.ZodType<Prisma.TokenUpdateManyWithoutUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateManyWithoutUserNestedInput>;
export const TokenUpdateManyWithoutUserNestedInputObjectZodSchema = makeSchema();
