import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletAddressChainCompoundUniqueInputObjectSchema as WalletAddressChainCompoundUniqueInputObjectSchema } from './WalletAddressChainCompoundUniqueInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  address_chain: z.lazy(() => WalletAddressChainCompoundUniqueInputObjectSchema).optional()
}).strict();
export const WalletWhereUniqueInputObjectSchema: z.ZodType<Prisma.WalletWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletWhereUniqueInput>;
export const WalletWhereUniqueInputObjectZodSchema = makeSchema();
