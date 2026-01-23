import * as z from 'zod';

export const WebhookOwnerTypeSchema = z.enum(['User', 'Pool', 'System'])

export type WebhookOwnerType = z.infer<typeof WebhookOwnerTypeSchema>;