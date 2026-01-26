import * as z from 'zod';
// prettier-ignore
export const OrganizationModelSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
    name: z.string(),
    slug: z.string(),
    organizationUsers: z.array(z.unknown()),
    tokens: z.array(z.unknown()),
    webhookSubscriptions: z.array(z.unknown()),
    inquiriesSent: z.array(z.unknown()),
    inquiriesReceived: z.array(z.unknown())
}).strict();

export type OrganizationPureType = z.infer<typeof OrganizationModelSchema>;
