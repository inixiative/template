import * as z from 'zod';
import { KycStatusSchema } from '../../enums/KycStatus.schema';
// prettier-ignore
export const UserModelSchema = z.object({
    id: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    passwordHash: z.string().nullable(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    kycStatus: KycStatusSchema,
    kycProvider: z.string().nullable(),
    kycExternalId: z.string().nullable(),
    kycVerifiedAt: z.date().nullable(),
    region: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    sessions: z.array(z.unknown()),
    wallets: z.array(z.unknown())
}).strict();

export type UserPureType = z.infer<typeof UserModelSchema>;
