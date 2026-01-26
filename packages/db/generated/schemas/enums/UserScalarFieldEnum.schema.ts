import * as z from 'zod';

export const UserScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'updatedAt', 'deletedAt', 'email', 'emailVerified', 'name', 'image', 'platformRole'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;