import * as z from 'zod';
import { KycStatusSchema } from '../../enums/KycStatus.schema';
// prettier-ignore
export const UserInputSchema = z.object({
    id: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    passwordHash: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    avatarUrl: z.string().optional().nullable(),
    kycStatus: KycStatusSchema,
    kycProvider: z.string().optional().nullable(),
    kycExternalId: z.string().optional().nullable(),
    kycVerifiedAt: z.date().optional().nullable(),
    region: z.string().optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    sessions: z.array(z.unknown()),
    wallets: z.array(z.unknown())
}).strict();

export type UserInputType = z.infer<typeof UserInputSchema>;
