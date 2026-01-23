import * as z from 'zod';
import { ChainSchema } from '../../enums/Chain.schema';
// prettier-ignore
export const WalletResultSchema = z.object({
    id: z.string(),
    userId: z.string(),
    address: z.string(),
    chain: ChainSchema,
    isPrimary: z.boolean(),
    isPayoutWallet: z.boolean(),
    verifiedAt: z.date().nullable(),
    createdAt: z.date(),
    user: z.unknown()
}).strict();

export type WalletResultType = z.infer<typeof WalletResultSchema>;
