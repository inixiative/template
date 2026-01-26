import * as z from 'zod';

export const WebhookModelSchema = z.enum(['User', 'Organization'])

export type WebhookModel = z.infer<typeof WebhookModelSchema>;