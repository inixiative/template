import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './WalletWhereUniqueInput.schema';
import { WalletCreateWithoutUserInputObjectSchema as WalletCreateWithoutUserInputObjectSchema } from './WalletCreateWithoutUserInput.schema';
import { WalletUncheckedCreateWithoutUserInputObjectSchema as WalletUncheckedCreateWithoutUserInputObjectSchema } from './WalletUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WalletWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WalletCreateWithoutUserInputObjectSchema), z.lazy(() => WalletUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const WalletCreateOrConnectWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletCreateOrConnectWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletCreateOrConnectWithoutUserInput>;
export const WalletCreateOrConnectWithoutUserInputObjectZodSchema = makeSchema();
