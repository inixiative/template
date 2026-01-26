import * as z from 'zod';

export const OrganizationUserScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'entitlements', 'createdAt', 'updatedAt'])

export type OrganizationUserScalarFieldEnum = z.infer<typeof OrganizationUserScalarFieldEnumSchema>;