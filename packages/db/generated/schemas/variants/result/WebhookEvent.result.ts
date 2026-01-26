import * as z from 'zod';
import { WebhookEventStatusSchema } from '../../enums/WebhookEventStatus.schema';
import { WebhookEventActionSchema } from '../../enums/WebhookEventAction.schema';
// prettier-ignore
export const WebhookEventResultSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    status: WebhookEventStatusSchema,
    action: WebhookEventActionSchema,
    payload: z.unknown().nullable(),
    error: z.string().nullable(),
    webhookSubscriptionId: z.string(),
    webhookSubscription: z.unknown(),
    resourceId: z.string()
}).strict();

export type WebhookEventResultType = z.infer<typeof WebhookEventResultSchema>;
