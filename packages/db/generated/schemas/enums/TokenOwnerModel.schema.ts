import * as z from 'zod';

export const TokenOwnerModelSchema = z.enum(['User', 'Organization', 'OrganizationUser'])

export type TokenOwnerModel = z.infer<typeof TokenOwnerModelSchema>;