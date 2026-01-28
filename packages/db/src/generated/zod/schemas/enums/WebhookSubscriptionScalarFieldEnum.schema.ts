import * as z from 'zod';

export const WebhookSubscriptionScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'updatedAt', 'model', 'url', 'isActive', 'ownerModel', 'userId', 'organizationId'])

export type WebhookSubscriptionScalarFieldEnum = z.infer<typeof WebhookSubscriptionScalarFieldEnumSchema>;