import * as z from 'zod';
import { ChainSchema } from '../../enums/Chain.schema';
// prettier-ignore
export const WalletInputSchema = z.object({
    id: z.string(),
    userId: z.string(),
    address: z.string(),
    chain: ChainSchema,
    isPrimary: z.boolean(),
    isPayoutWallet: z.boolean(),
    verifiedAt: z.date().optional().nullable(),
    createdAt: z.date(),
    user: z.unknown()
}).strict();

export type WalletInputType = z.infer<typeof WalletInputSchema>;
