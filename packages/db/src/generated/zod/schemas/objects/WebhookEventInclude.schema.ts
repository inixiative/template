import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionArgsObjectSchema as WebhookSubscriptionArgsObjectSchema } from './WebhookSubscriptionArgs.schema'

const makeSchema = () => z.object({
  webhookSubscription: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionArgsObjectSchema)]).optional()
}).strict();
export const WebhookEventIncludeObjectSchema: z.ZodType<Prisma.WebhookEventInclude> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventInclude>;
export const WebhookEventIncludeObjectZodSchema = makeSchema();
