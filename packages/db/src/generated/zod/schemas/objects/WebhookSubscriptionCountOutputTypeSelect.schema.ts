import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCountOutputTypeCountWebhookEventsArgsObjectSchema as WebhookSubscriptionCountOutputTypeCountWebhookEventsArgsObjectSchema } from './WebhookSubscriptionCountOutputTypeCountWebhookEventsArgs.schema'

const makeSchema = () => z.object({
  webhookEvents: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionCountOutputTypeCountWebhookEventsArgsObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionCountOutputTypeSelectObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCountOutputTypeSelect> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCountOutputTypeSelect>;
export const WebhookSubscriptionCountOutputTypeSelectObjectZodSchema = makeSchema();
