import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenCreateWithoutOrganizationUserInputObjectSchema as TokenCreateWithoutOrganizationUserInputObjectSchema } from './TokenCreateWithoutOrganizationUserInput.schema';
import { TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema as TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationUserInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationUserInputObjectSchema)])
}).strict();
export const TokenCreateOrConnectWithoutOrganizationUserInputObjectSchema: z.ZodType<Prisma.TokenCreateOrConnectWithoutOrganizationUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateOrConnectWithoutOrganizationUserInput>;
export const TokenCreateOrConnectWithoutOrganizationUserInputObjectZodSchema = makeSchema();
