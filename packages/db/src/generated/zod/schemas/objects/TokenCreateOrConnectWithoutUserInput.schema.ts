import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenCreateWithoutUserInputObjectSchema as TokenCreateWithoutUserInputObjectSchema } from './TokenCreateWithoutUserInput.schema';
import { TokenUncheckedCreateWithoutUserInputObjectSchema as TokenUncheckedCreateWithoutUserInputObjectSchema } from './TokenUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => TokenCreateWithoutUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const TokenCreateOrConnectWithoutUserInputObjectSchema: z.ZodType<Prisma.TokenCreateOrConnectWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateOrConnectWithoutUserInput>;
export const TokenCreateOrConnectWithoutUserInputObjectZodSchema = makeSchema();
