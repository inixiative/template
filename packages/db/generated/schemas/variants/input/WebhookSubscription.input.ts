import * as z from 'zod';
import { WebhookModelSchema } from '../../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../../enums/WebhookOwnerModel.schema';
// prettier-ignore
export const WebhookSubscriptionInputSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    model: WebhookModelSchema,
    url: z.string(),
    secret: z.string().optional().nullable(),
    isActive: z.boolean(),
    ownerModel: WebhookOwnerModelSchema,
    userId: z.string().optional().nullable(),
    organizationId: z.string().optional().nullable(),
    user: z.unknown().optional().nullable(),
    organization: z.unknown().optional().nullable(),
    events: z.array(z.unknown())
}).strict();

export type WebhookSubscriptionInputType = z.infer<typeof WebhookSubscriptionInputSchema>;
