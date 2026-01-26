import * as z from 'zod';
import { WebhookModelSchema } from '../../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../../enums/WebhookOwnerModel.schema';
// prettier-ignore
export const WebhookSubscriptionModelSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    model: WebhookModelSchema,
    url: z.string(),
    secret: z.string().nullable(),
    isActive: z.boolean(),
    ownerModel: WebhookOwnerModelSchema,
    userId: z.string().nullable(),
    organizationId: z.string().nullable(),
    user: z.unknown().nullable(),
    organization: z.unknown().nullable(),
    events: z.array(z.unknown())
}).strict();

export type WebhookSubscriptionPureType = z.infer<typeof WebhookSubscriptionModelSchema>;
