import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletCreateWithoutUserInputObjectSchema as WalletCreateWithoutUserInputObjectSchema } from './WalletCreateWithoutUserInput.schema';
import { WalletUncheckedCreateWithoutUserInputObjectSchema as WalletUncheckedCreateWithoutUserInputObjectSchema } from './WalletUncheckedCreateWithoutUserInput.schema';
import { WalletCreateOrConnectWithoutUserInputObjectSchema as WalletCreateOrConnectWithoutUserInputObjectSchema } from './WalletCreateOrConnectWithoutUserInput.schema';
import { WalletUpsertWithWhereUniqueWithoutUserInputObjectSchema as WalletUpsertWithWhereUniqueWithoutUserInputObjectSchema } from './WalletUpsertWithWhereUniqueWithoutUserInput.schema';
import { WalletCreateManyUserInputEnvelopeObjectSchema as WalletCreateManyUserInputEnvelopeObjectSchema } from './WalletCreateManyUserInputEnvelope.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './WalletWhereUniqueInput.schema';
import { WalletUpdateWithWhereUniqueWithoutUserInputObjectSchema as WalletUpdateWithWhereUniqueWithoutUserInputObjectSchema } from './WalletUpdateWithWhereUniqueWithoutUserInput.schema';
import { WalletUpdateManyWithWhereWithoutUserInputObjectSchema as WalletUpdateManyWithWhereWithoutUserInputObjectSchema } from './WalletUpdateManyWithWhereWithoutUserInput.schema';
import { WalletScalarWhereInputObjectSchema as WalletScalarWhereInputObjectSchema } from './WalletScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WalletCreateWithoutUserInputObjectSchema), z.lazy(() => WalletCreateWithoutUserInputObjectSchema).array(), z.lazy(() => WalletUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => WalletUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WalletCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => WalletCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => WalletUpsertWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => WalletUpsertWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WalletCreateManyUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => WalletWhereUniqueInputObjectSchema), z.lazy(() => WalletWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => WalletWhereUniqueInputObjectSchema), z.lazy(() => WalletWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => WalletWhereUniqueInputObjectSchema), z.lazy(() => WalletWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => WalletWhereUniqueInputObjectSchema), z.lazy(() => WalletWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => WalletUpdateWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => WalletUpdateWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => WalletUpdateManyWithWhereWithoutUserInputObjectSchema), z.lazy(() => WalletUpdateManyWithWhereWithoutUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => WalletScalarWhereInputObjectSchema), z.lazy(() => WalletScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const WalletUpdateManyWithoutUserNestedInputObjectSchema: z.ZodType<Prisma.WalletUpdateManyWithoutUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletUpdateManyWithoutUserNestedInput>;
export const WalletUpdateManyWithoutUserNestedInputObjectZodSchema = makeSchema();
