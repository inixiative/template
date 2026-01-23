import * as z from 'zod';
import { ChainSchema } from '../../enums/Chain.schema';
// prettier-ignore
export const WalletModelSchema = z.object({
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

export type WalletPureType = z.infer<typeof WalletModelSchema>;
