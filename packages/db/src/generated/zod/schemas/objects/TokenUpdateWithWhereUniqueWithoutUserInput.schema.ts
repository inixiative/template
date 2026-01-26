import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithoutUserInputObjectSchema as TokenUpdateWithoutUserInputObjectSchema } from './TokenUpdateWithoutUserInput.schema';
import { TokenUncheckedUpdateWithoutUserInputObjectSchema as TokenUncheckedUpdateWithoutUserInputObjectSchema } from './TokenUncheckedUpdateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => TokenUpdateWithoutUserInputObjectSchema), z.lazy(() => TokenUncheckedUpdateWithoutUserInputObjectSchema)])
}).strict();
export const TokenUpdateWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.TokenUpdateWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateWithWhereUniqueWithoutUserInput>;
export const TokenUpdateWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
