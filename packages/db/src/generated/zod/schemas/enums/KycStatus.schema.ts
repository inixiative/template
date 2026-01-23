import * as z from 'zod';

export const KycStatusSchema = z.enum(['NONE', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'])

export type KycStatus = z.infer<typeof KycStatusSchema>;