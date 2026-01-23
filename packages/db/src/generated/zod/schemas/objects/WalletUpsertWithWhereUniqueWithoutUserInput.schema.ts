import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './WalletWhereUniqueInput.schema';
import { WalletUpdateWithoutUserInputObjectSchema as WalletUpdateWithoutUserInputObjectSchema } from './WalletUpdateWithoutUserInput.schema';
import { WalletUncheckedUpdateWithoutUserInputObjectSchema as WalletUncheckedUpdateWithoutUserInputObjectSchema } from './WalletUncheckedUpdateWithoutUserInput.schema';
import { WalletCreateWithoutUserInputObjectSchema as WalletCreateWithoutUserInputObjectSchema } from './WalletCreateWithoutUserInput.schema';
import { WalletUncheckedCreateWithoutUserInputObjectSchema as WalletUncheckedCreateWithoutUserInputObjectSchema } from './WalletUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WalletWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => WalletUpdateWithoutUserInputObjectSchema), z.lazy(() => WalletUncheckedUpdateWithoutUserInputObjectSchema)]),
  create: z.union([z.lazy(() => WalletCreateWithoutUserInputObjectSchema), z.lazy(() => WalletUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const WalletUpsertWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletUpsertWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletUpsertWithWhereUniqueWithoutUserInput>;
export const WalletUpsertWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
