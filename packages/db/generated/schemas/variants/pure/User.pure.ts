import * as z from 'zod';
import { PlatformRoleSchema } from '../../enums/PlatformRole.schema';
// prettier-ignore
export const UserModelSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
    email: z.string(),
    emailVerified: z.boolean(),
    name: z.string().nullable(),
    image: z.string().nullable(),
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

export type UserPureType = z.infer<typeof UserModelSchema>;
