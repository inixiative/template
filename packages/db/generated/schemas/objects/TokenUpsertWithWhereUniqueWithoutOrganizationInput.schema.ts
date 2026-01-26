import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithoutOrganizationInputObjectSchema as TokenUpdateWithoutOrganizationInputObjectSchema } from './TokenUpdateWithoutOrganizationInput.schema';
import { TokenUncheckedUpdateWithoutOrganizationInputObjectSchema as TokenUncheckedUpdateWithoutOrganizationInputObjectSchema } from './TokenUncheckedUpdateWithoutOrganizationInput.schema';
import { TokenCreateWithoutOrganizationInputObjectSchema as TokenCreateWithoutOrganizationInputObjectSchema } from './TokenCreateWithoutOrganizationInput.schema';
import { TokenUncheckedCreateWithoutOrganizationInputObjectSchema as TokenUncheckedCreateWithoutOrganizationInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => TokenUpdateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUncheckedUpdateWithoutOrganizationInputObjectSchema)]),
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationInputObjectSchema)])
}).strict();
export const TokenUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.TokenUpsertWithWhereUniqueWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpsertWithWhereUniqueWithoutOrganizationInput>;
export const TokenUpsertWithWhereUniqueWithoutOrganizationInputObjectZodSchema = makeSchema();
