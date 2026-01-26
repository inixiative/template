import * as z from 'zod';

export const TokenScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'updatedAt', 'name', 'keyHash', 'keyPrefix', 'ownerModel', 'userId', 'organizationId', 'role', 'entitlements', 'expiresAt', 'lastUsedAt', 'isActive'])

export type TokenScalarFieldEnum = z.infer<typeof TokenScalarFieldEnumSchema>;