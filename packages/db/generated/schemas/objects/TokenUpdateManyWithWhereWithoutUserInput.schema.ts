import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenScalarWhereInputObjectSchema as TokenScalarWhereInputObjectSchema } from './TokenScalarWhereInput.schema';
import { TokenUpdateManyMutationInputObjectSchema as TokenUpdateManyMutationInputObjectSchema } from './TokenUpdateManyMutationInput.schema';
import { TokenUncheckedUpdateManyWithoutUserInputObjectSchema as TokenUncheckedUpdateManyWithoutUserInputObjectSchema } from './TokenUncheckedUpdateManyWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => TokenUpdateManyMutationInputObjectSchema), z.lazy(() => TokenUncheckedUpdateManyWithoutUserInputObjectSchema)])
}).strict();
export const TokenUpdateManyWithWhereWithoutUserInputObjectSchema: z.ZodType<Prisma.TokenUpdateManyWithWhereWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateManyWithWhereWithoutUserInput>;
export const TokenUpdateManyWithWhereWithoutUserInputObjectZodSchema = makeSchema();
