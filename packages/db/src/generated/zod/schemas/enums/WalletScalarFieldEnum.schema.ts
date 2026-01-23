import * as z from 'zod';

export const WalletScalarFieldEnumSchema = z.enum(['id', 'userId', 'address', 'chain', 'isPrimary', 'isPayoutWallet', 'verifiedAt', 'createdAt'])

export type WalletScalarFieldEnum = z.infer<typeof WalletScalarFieldEnumSchema>;