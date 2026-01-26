import * as z from 'zod';

export const OrganizationRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer'])

export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;