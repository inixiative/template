import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional()
}).strict();
export const UserCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema = makeSchema();
export const UserCountOutputTypeCountWebhookSubscriptionsArgsObjectZodSchema = makeSchema();
