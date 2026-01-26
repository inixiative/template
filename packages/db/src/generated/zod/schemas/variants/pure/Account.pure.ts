import * as z from 'zod';
// prettier-ignore
export const AccountModelSchema = z.object({
    id: z.string(),
    userId: z.string(),
    accountId: z.string(),
    providerId: z.string(),
    accessToken: z.string().nullable(),
    refreshToken: z.string().nullable(),
    accessTokenExpiresAt: z.date().nullable(),
    refreshTokenExpiresAt: z.date().nullable(),
    scope: z.string().nullable(),
    idToken: z.string().nullable(),
    password: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    user: z.unknown()
}).strict();

export type AccountPureType = z.infer<typeof AccountModelSchema>;
