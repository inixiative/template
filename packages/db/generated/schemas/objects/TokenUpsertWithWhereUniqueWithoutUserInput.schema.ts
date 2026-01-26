import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithoutUserInputObjectSchema as TokenUpdateWithoutUserInputObjectSchema } from './TokenUpdateWithoutUserInput.schema';
import { TokenUncheckedUpdateWithoutUserInputObjectSchema as TokenUncheckedUpdateWithoutUserInputObjectSchema } from './TokenUncheckedUpdateWithoutUserInput.schema';
import { TokenCreateWithoutUserInputObjectSchema as TokenCreateWithoutUserInputObjectSchema } from './TokenCreateWithoutUserInput.schema';
import { TokenUncheckedCreateWithoutUserInputObjectSchema as TokenUncheckedCreateWithoutUserInputObjectSchema } from './TokenUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => TokenUpdateWithoutUserInputObjectSchema), z.lazy(() => TokenUncheckedUpdateWithoutUserInputObjectSchema)]),
  create: z.union([z.lazy(() => TokenCreateWithoutUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const TokenUpsertWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.TokenUpsertWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpsertWithWhereUniqueWithoutUserInput>;
export const TokenUpsertWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
