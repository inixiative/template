import * as z from 'zod';
// prettier-ignore
export const SessionModelSchema = z.object({
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

export type SessionPureType = z.infer<typeof SessionModelSchema>;
