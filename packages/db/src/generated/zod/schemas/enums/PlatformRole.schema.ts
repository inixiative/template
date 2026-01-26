import * as z from 'zod';

export const PlatformRoleSchema = z.enum(['user', 'superadmin'])

export type PlatformRole = z.infer<typeof PlatformRoleSchema>;