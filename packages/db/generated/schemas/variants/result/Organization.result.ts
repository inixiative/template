import * as z from 'zod';
// prettier-ignore
export const OrganizationResultSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
    name: z.string(),
    slug: z.string(),
    users: z.array(z.unknown()),
    tokens: z.array(z.unknown()),
    webhookSubscriptions: z.array(z.unknown()),
    inquiriesSent: z.array(z.unknown()),
    inquiriesReceived: z.array(z.unknown())
}).strict();

export type OrganizationResultType = z.infer<typeof OrganizationResultSchema>;
