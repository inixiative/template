import * as z from 'zod';
import { TokenOwnerModelSchema } from '../../enums/TokenOwnerModel.schema';
import { OrganizationRoleSchema } from '../../enums/OrganizationRole.schema';
// prettier-ignore
export const TokenModelSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    name: z.string(),
    keyHash: z.string(),
    keyPrefix: z.string(),
    ownerModel: TokenOwnerModelSchema,
    userId: z.string().nullable(),
    organizationId: z.string().nullable(),
    user: z.unknown().nullable(),
    organization: z.unknown().nullable(),
    organizationUser: z.unknown().nullable(),
    role: OrganizationRoleSchema,
    entitlements: z.unknown().nullable(),
    expiresAt: z.date().nullable(),
    lastUsedAt: z.date().nullable(),
    isActive: z.boolean()
}).strict();

export type TokenPureType = z.infer<typeof TokenModelSchema>;
