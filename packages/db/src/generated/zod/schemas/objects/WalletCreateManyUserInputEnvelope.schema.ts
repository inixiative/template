import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletCreateManyUserInputObjectSchema as WalletCreateManyUserInputObjectSchema } from './WalletCreateManyUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => WalletCreateManyUserInputObjectSchema), z.lazy(() => WalletCreateManyUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const WalletCreateManyUserInputEnvelopeObjectSchema: z.ZodType<Prisma.WalletCreateManyUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.WalletCreateManyUserInputEnvelope>;
export const WalletCreateManyUserInputEnvelopeObjectZodSchema = makeSchema();
