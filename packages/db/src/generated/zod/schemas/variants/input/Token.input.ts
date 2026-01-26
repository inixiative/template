import * as z from 'zod';
import { TokenOwnerModelSchema } from '../../enums/TokenOwnerModel.schema';
import { OrganizationRoleSchema } from '../../enums/OrganizationRole.schema';
// prettier-ignore
export const TokenInputSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    name: z.string(),
    keyHash: z.string(),
    keyPrefix: z.string(),
    ownerModel: TokenOwnerModelSchema,
    userId: z.string().optional().nullable(),
    organizationId: z.string().optional().nullable(),
    user: z.unknown().optional().nullable(),
    organization: z.unknown().optional().nullable(),
    organizationUser: z.unknown().optional().nullable(),
    role: OrganizationRoleSchema,
    entitlements: z.unknown().optional().nullable(),
    expiresAt: z.date().optional().nullable(),
    lastUsedAt: z.date().optional().nullable(),
    isActive: z.boolean()
}).strict();

export type TokenInputType = z.infer<typeof TokenInputSchema>;
