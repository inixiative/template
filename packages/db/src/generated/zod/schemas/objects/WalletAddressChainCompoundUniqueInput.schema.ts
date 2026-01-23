import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema'

const makeSchema = () => z.object({
  address: z.string(),
  chain: ChainSchema
}).strict();
export const WalletAddressChainCompoundUniqueInputObjectSchema: z.ZodType<Prisma.WalletAddressChainCompoundUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletAddressChainCompoundUniqueInput>;
export const WalletAddressChainCompoundUniqueInputObjectZodSchema = makeSchema();
