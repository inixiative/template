import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithoutOrganizationInputObjectSchema as TokenUpdateWithoutOrganizationInputObjectSchema } from './TokenUpdateWithoutOrganizationInput.schema';
import { TokenUncheckedUpdateWithoutOrganizationInputObjectSchema as TokenUncheckedUpdateWithoutOrganizationInputObjectSchema } from './TokenUncheckedUpdateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => TokenUpdateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUncheckedUpdateWithoutOrganizationInputObjectSchema)])
}).strict();
export const TokenUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.TokenUpdateWithWhereUniqueWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateWithWhereUniqueWithoutOrganizationInput>;
export const TokenUpdateWithWhereUniqueWithoutOrganizationInputObjectZodSchema = makeSchema();
