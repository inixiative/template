import * as z from 'zod';
import { PlatformRoleSchema } from '../../enums/PlatformRole.schema';
// prettier-ignore
export const UserInputSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().optional().nullable(),
    email: z.string(),
    emailVerified: z.boolean(),
    name: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    platformRole: PlatformRoleSchema,
    accounts: z.array(z.unknown()),
    sessions: z.array(z.unknown()),
    organizations: z.array(z.unknown()),
    tokens: z.array(z.unknown()),
    cronJobsCreated: z.array(z.unknown()),
    webhookSubscriptions: z.array(z.unknown()),
    inquiriesSent: z.array(z.unknown()),
    inquiriesReceived: z.array(z.unknown())
}).strict();

export type UserInputType = z.infer<typeof UserInputSchema>;
