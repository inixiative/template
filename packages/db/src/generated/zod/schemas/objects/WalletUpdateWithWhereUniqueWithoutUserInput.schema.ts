import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './WalletWhereUniqueInput.schema';
import { WalletUpdateWithoutUserInputObjectSchema as WalletUpdateWithoutUserInputObjectSchema } from './WalletUpdateWithoutUserInput.schema';
import { WalletUncheckedUpdateWithoutUserInputObjectSchema as WalletUncheckedUpdateWithoutUserInputObjectSchema } from './WalletUncheckedUpdateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WalletWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => WalletUpdateWithoutUserInputObjectSchema), z.lazy(() => WalletUncheckedUpdateWithoutUserInputObjectSchema)])
}).strict();
export const WalletUpdateWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletUpdateWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletUpdateWithWhereUniqueWithoutUserInput>;
export const WalletUpdateWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
