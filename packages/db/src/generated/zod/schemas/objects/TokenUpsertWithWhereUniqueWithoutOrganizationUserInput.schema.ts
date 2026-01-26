import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithoutOrganizationUserInputObjectSchema as TokenUpdateWithoutOrganizationUserInputObjectSchema } from './TokenUpdateWithoutOrganizationUserInput.schema';
import { TokenUncheckedUpdateWithoutOrganizationUserInputObjectSchema as TokenUncheckedUpdateWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedUpdateWithoutOrganizationUserInput.schema';
import { TokenCreateWithoutOrganizationUserInputObjectSchema as TokenCreateWithoutOrganizationUserInputObjectSchema } from './TokenCreateWithoutOrganizationUserInput.schema';
import { TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema as TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => TokenUpdateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUncheckedUpdateWithoutOrganizationUserInputObjectSchema)]),
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema)])
}).strict();
export const TokenUpsertWithWhereUniqueWithoutOrganizationUserInputObjectSchema: z.ZodType<Prisma.TokenUpsertWithWhereUniqueWithoutOrganizationUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpsertWithWhereUniqueWithoutOrganizationUserInput>;
export const TokenUpsertWithWhereUniqueWithoutOrganizationUserInputObjectZodSchema = makeSchema();
