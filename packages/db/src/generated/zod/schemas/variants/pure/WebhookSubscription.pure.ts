import * as z from 'zod';
import { WebhookModelSchema } from '../../enums/WebhookModel.schema';
import { WebhookOwnerTypeSchema } from '../../enums/WebhookOwnerType.schema';
// prettier-ignore
export const WebhookSubscriptionModelSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    model: WebhookModelSchema,
    url: z.string(),
    secret: z.string().nullable(),
    isActive: z.boolean(),
    ownerType: WebhookOwnerTypeSchema,
    ownerId: z.string(),
    events: z.array(z.unknown())
}).strict();

export type WebhookSubscriptionPureType = z.infer<typeof WebhookSubscriptionModelSchema>;
