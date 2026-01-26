import * as z from 'zod';

export const WebhookOwnerModelSchema = z.enum(['User', 'Organization'])

export type WebhookOwnerModel = z.infer<typeof WebhookOwnerModelSchema>;