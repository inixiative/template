import * as z from 'zod';
import { OrganizationRoleSchema } from '../../enums/OrganizationRole.schema';
// prettier-ignore
export const OrganizationUserResultSchema = z.object({
    id: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    role: OrganizationRoleSchema,
    entitlements: z.unknown().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    organization: z.unknown(),
    user: z.unknown(),
    tokens: z.array(z.unknown())
}).strict();

export type OrganizationUserResultType = z.infer<typeof OrganizationUserResultSchema>;
