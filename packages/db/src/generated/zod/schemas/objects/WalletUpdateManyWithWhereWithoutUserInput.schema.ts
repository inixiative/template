import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletScalarWhereInputObjectSchema as WalletScalarWhereInputObjectSchema } from './WalletScalarWhereInput.schema';
import { WalletUpdateManyMutationInputObjectSchema as WalletUpdateManyMutationInputObjectSchema } from './WalletUpdateManyMutationInput.schema';
import { WalletUncheckedUpdateManyWithoutUserInputObjectSchema as WalletUncheckedUpdateManyWithoutUserInputObjectSchema } from './WalletUncheckedUpdateManyWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WalletScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => WalletUpdateManyMutationInputObjectSchema), z.lazy(() => WalletUncheckedUpdateManyWithoutUserInputObjectSchema)])
}).strict();
export const WalletUpdateManyWithWhereWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletUpdateManyWithWhereWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletUpdateManyWithWhereWithoutUserInput>;
export const WalletUpdateManyWithWhereWithoutUserInputObjectZodSchema = makeSchema();
