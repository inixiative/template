import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCountOutputTypeCountEventsArgsObjectSchema as WebhookSubscriptionCountOutputTypeCountEventsArgsObjectSchema } from './WebhookSubscriptionCountOutputTypeCountEventsArgs.schema'

const makeSchema = () => z.object({
  events: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionCountOutputTypeCountEventsArgsObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionCountOutputTypeSelectObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCountOutputTypeSelect> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCountOutputTypeSelect>;
export const WebhookSubscriptionCountOutputTypeSelectObjectZodSchema = makeSchema();
