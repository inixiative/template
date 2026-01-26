import * as z from 'zod';
// prettier-ignore
export const AccountInputSchema = z.object({
    id: z.string(),
    userId: z.string(),
    accountId: z.string(),
    providerId: z.string(),
    accessToken: z.string().optional().nullable(),
    refreshToken: z.string().optional().nullable(),
    accessTokenExpiresAt: z.date().optional().nullable(),
    refreshTokenExpiresAt: z.date().optional().nullable(),
    scope: z.string().optional().nullable(),
    idToken: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    user: z.unknown()
}).strict();

export type AccountInputType = z.infer<typeof AccountInputSchema>;
