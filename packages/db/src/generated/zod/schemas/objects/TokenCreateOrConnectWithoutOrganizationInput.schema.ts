import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenCreateWithoutOrganizationInputObjectSchema as TokenCreateWithoutOrganizationInputObjectSchema } from './TokenCreateWithoutOrganizationInput.schema';
import { TokenUncheckedCreateWithoutOrganizationInputObjectSchema as TokenUncheckedCreateWithoutOrganizationInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationInputObjectSchema)])
}).strict();
export const TokenCreateOrConnectWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.TokenCreateOrConnectWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateOrConnectWithoutOrganizationInput>;
export const TokenCreateOrConnectWithoutOrganizationInputObjectZodSchema = makeSchema();
