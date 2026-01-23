import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletCreateWithoutUserInputObjectSchema as WalletCreateWithoutUserInputObjectSchema } from './WalletCreateWithoutUserInput.schema';
import { WalletUncheckedCreateWithoutUserInputObjectSchema as WalletUncheckedCreateWithoutUserInputObjectSchema } from './WalletUncheckedCreateWithoutUserInput.schema';
import { WalletCreateOrConnectWithoutUserInputObjectSchema as WalletCreateOrConnectWithoutUserInputObjectSchema } from './WalletCreateOrConnectWithoutUserInput.schema';
import { WalletCreateManyUserInputEnvelopeObjectSchema as WalletCreateManyUserInputEnvelopeObjectSchema } from './WalletCreateManyUserInputEnvelope.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './WalletWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WalletCreateWithoutUserInputObjectSchema), z.lazy(() => WalletCreateWithoutUserInputObjectSchema).array(), z.lazy(() => WalletUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => WalletUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WalletCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => WalletCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WalletCreateManyUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => WalletWhereUniqueInputObjectSchema), z.lazy(() => WalletWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletUncheckedCreateNestedManyWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletUncheckedCreateNestedManyWithoutUserInput>;
export const WalletUncheckedCreateNestedManyWithoutUserInputObjectZodSchema = makeSchema();
