import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithoutOrganizationUserInputObjectSchema as TokenUpdateWithoutOrganizationUserInputObjectSchema } from './TokenUpdateWithoutOrganizationUserInput.schema';
import { TokenUncheckedUpdateWithoutOrganizationUserInputObjectSchema as TokenUncheckedUpdateWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedUpdateWithoutOrganizationUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => TokenUpdateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUncheckedUpdateWithoutOrganizationUserInputObjectSchema)])
}).strict();
export const TokenUpdateWithWhereUniqueWithoutOrganizationUserInputObjectSchema: z.ZodType<Prisma.TokenUpdateWithWhereUniqueWithoutOrganizationUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateWithWhereUniqueWithoutOrganizationUserInput>;
export const TokenUpdateWithWhereUniqueWithoutOrganizationUserInputObjectZodSchema = makeSchema();
