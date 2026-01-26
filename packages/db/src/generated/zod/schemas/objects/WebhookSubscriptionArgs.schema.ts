import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionSelectObjectSchema as WebhookSubscriptionSelectObjectSchema } from './WebhookSubscriptionSelect.schema';
import { WebhookSubscriptionIncludeObjectSchema as WebhookSubscriptionIncludeObjectSchema } from './WebhookSubscriptionInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => WebhookSubscriptionSelectObjectSchema).optional(),
  include: z.lazy(() => WebhookSubscriptionIncludeObjectSchema).optional()
}).strict();
export const WebhookSubscriptionArgsObjectSchema = makeSchema();
export const WebhookSubscriptionArgsObjectZodSchema = makeSchema();
