import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateWithoutOrganizationInputObjectSchema as TokenCreateWithoutOrganizationInputObjectSchema } from './TokenCreateWithoutOrganizationInput.schema';
import { TokenUncheckedCreateWithoutOrganizationInputObjectSchema as TokenUncheckedCreateWithoutOrganizationInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationInput.schema';
import { TokenCreateOrConnectWithoutOrganizationInputObjectSchema as TokenCreateOrConnectWithoutOrganizationInputObjectSchema } from './TokenCreateOrConnectWithoutOrganizationInput.schema';
import { TokenCreateManyOrganizationInputEnvelopeObjectSchema as TokenCreateManyOrganizationInputEnvelopeObjectSchema } from './TokenCreateManyOrganizationInputEnvelope.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenCreateWithoutOrganizationInputObjectSchema).array(), z.lazy(() => TokenUncheckedCreateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => TokenCreateOrConnectWithoutOrganizationInputObjectSchema), z.lazy(() => TokenCreateOrConnectWithoutOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => TokenCreateManyOrganizationInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.TokenUncheckedCreateNestedManyWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUncheckedCreateNestedManyWithoutOrganizationInput>;
export const TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectZodSchema = makeSchema();
