import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './WebhookEventWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCountOutputTypeCountEventsArgsObjectSchema = makeSchema();
export const WebhookSubscriptionCountOutputTypeCountEventsArgsObjectZodSchema = makeSchema();
