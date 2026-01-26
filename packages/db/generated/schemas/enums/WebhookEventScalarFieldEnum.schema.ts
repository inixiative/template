import * as z from 'zod';

export const WebhookEventScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'status', 'action', 'payload', 'error', 'webhookSubscriptionId', 'resourceId'])

export type WebhookEventScalarFieldEnum = z.infer<typeof WebhookEventScalarFieldEnumSchema>;