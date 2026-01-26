import * as z from 'zod';

export const WebhookEventStatusSchema = z.enum(['pending', 'success', 'error', 'unreachable'])

export type WebhookEventStatus = z.infer<typeof WebhookEventStatusSchema>;