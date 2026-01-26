import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenCreateWithoutOrganizationInputObjectSchema as TokenCreateWithoutOrganizationInputObjectSchema } from './TokenCreateWithoutOrganizationInput.schema';
import { TokenUncheckedCreateWithoutOrganizationInputObjectSchema as TokenUncheckedCreateWithoutOrganizationInputObjectSchema } from './TokenUncheckedCreateWithoutOrganizationInput.schema';
import { TokenCreateOrConnectWithoutOrganizationInputObjectSchema as TokenCreateOrConnectWithoutOrganizationInputObjectSchema } from './TokenCreateOrConnectWithoutOrganizationInput.schema';
import { TokenUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema as TokenUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema } from './TokenUpsertWithWhereUniqueWithoutOrganizationInput.schema';
import { TokenCreateManyOrganizationInputEnvelopeObjectSchema as TokenCreateManyOrganizationInputEnvelopeObjectSchema } from './TokenCreateManyOrganizationInputEnvelope.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './TokenWhereUniqueInput.schema';
import { TokenUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema as TokenUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema } from './TokenUpdateWithWhereUniqueWithoutOrganizationInput.schema';
import { TokenUpdateManyWithWhereWithoutOrganizationInputObjectSchema as TokenUpdateManyWithWhereWithoutOrganizationInputObjectSchema } from './TokenUpdateManyWithWhereWithoutOrganizationInput.schema';
import { TokenScalarWhereInputObjectSchema as TokenScalarWhereInputObjectSchema } from './TokenScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => TokenCreateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenCreateWithoutOrganizationInputObjectSchema).array(), z.lazy(() => TokenUncheckedCreateWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUncheckedCreateWithoutOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => TokenCreateOrConnectWithoutOrganizationInputObjectSchema), z.lazy(() => TokenCreateOrConnectWithoutOrganizationInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => TokenUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => TokenCreateManyOrganizationInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => TokenWhereUniqueInputObjectSchema), z.lazy(() => TokenWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => TokenUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => TokenUpdateManyWithWhereWithoutOrganizationInputObjectSchema), z.lazy(() => TokenUpdateManyWithWhereWithoutOrganizationInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => TokenScalarWhereInputObjectSchema), z.lazy(() => TokenScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const TokenUpdateManyWithoutOrganizationNestedInputObjectSchema: z.ZodType<Prisma.TokenUpdateManyWithoutOrganizationNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateManyWithoutOrganizationNestedInput>;
export const TokenUpdateManyWithoutOrganizationNestedInputObjectZodSchema = makeSchema();
