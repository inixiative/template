import * as z from 'zod';

export const WebhookEventActionSchema = z.enum(['create', 'update', 'delete'])

export type WebhookEventAction = z.infer<typeof WebhookEventActionSchema>;