import * as z from 'zod';

export const AccountScalarFieldEnumSchema = z.enum(['id', 'userId', 'accountId', 'providerId', 'accessToken', 'refreshToken', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'idToken', 'password', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;