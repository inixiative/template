import * as z from 'zod';

export const WebhookSubscriptionScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'updatedAt', 'model', 'url', 'secret', 'isActive', 'ownerType', 'ownerId'])

export type WebhookSubscriptionScalarFieldEnum = z.infer<typeof WebhookSubscriptionScalarFieldEnumSchema>;