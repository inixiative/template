import * as z from 'zod';
// prettier-ignore
export const SessionResultSchema = z.object({
    id: z.string(),
    userId: z.string(),
    token: z.string(),
    expiresAt: z.date(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    user: z.unknown()
}).strict();

export type SessionResultType = z.infer<typeof SessionResultSchema>;
