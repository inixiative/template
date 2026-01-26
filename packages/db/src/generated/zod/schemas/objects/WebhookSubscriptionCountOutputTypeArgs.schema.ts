import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCountOutputTypeSelectObjectSchema as WebhookSubscriptionCountOutputTypeSelectObjectSchema } from './WebhookSubscriptionCountOutputTypeSelect.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => WebhookSubscriptionCountOutputTypeSelectObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCountOutputTypeArgsObjectSchema = makeSchema();
export const WebhookSubscriptionCountOutputTypeArgsObjectZodSchema = makeSchema();
