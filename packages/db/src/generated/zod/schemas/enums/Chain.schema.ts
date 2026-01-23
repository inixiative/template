import * as z from 'zod';

export const ChainSchema = z.enum(['ETHEREUM', 'ARBITRUM'])

export type Chain = z.infer<typeof ChainSchema>;