import * as z from 'zod';

export const UserScalarFieldEnumSchema = z.enum(['id', 'email', 'emailVerified', 'passwordHash', 'name', 'avatarUrl', 'kycStatus', 'kycProvider', 'kycExternalId', 'kycVerifiedAt', 'region', 'createdAt', 'updatedAt'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;