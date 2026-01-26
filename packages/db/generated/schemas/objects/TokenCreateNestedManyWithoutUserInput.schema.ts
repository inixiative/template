import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateWithoutUserInputObjectSchema as TokenCreateWithoutUserInputObjectSchema } from './TokenCreateWithoutUserInput.schema';
import { TokenUncheckedCreateWithoutUserInputObjectSchema as TokenUncheckedCreateWithoutUserInputObjectSchema } from './TokenUncheckedCreateWithoutUserInput.schema';
import { TokenCreateOrConnectWithoutUserInputObjectSchema as TokenCreateOrConnectWithoutUserInputObjectSchema } from './TokenCreateOrConnectWithoutUserInput.schema';
import { TokenCreateManyUserInputEnvelopeObjectSchema as TokenCreateManyUserInputEnvelopeObjectSchema } from './TokenCreateManyUserInputEnvelope.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => TokenCreateWithoutUserInputObjectSchema), z.lazy(() => TokenCreateWithoutUserInputObjectSchema).array(), z.lazy(() => TokenUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => TokenCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => TokenCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => TokenCreateManyUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const TokenCreateNestedManyWithoutUserInputObjectSchema: z.ZodType<Prisma.TokenCreateNestedManyWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateNestedManyWithoutUserInput>;
export const TokenCreateNestedManyWithoutUserInputObjectZodSchema = makeSchema();
