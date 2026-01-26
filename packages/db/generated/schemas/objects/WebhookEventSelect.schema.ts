import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionArgsObjectSchema as WebhookSubscriptionArgsObjectSchema } from './WebhookSubscriptionArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  status: z.boolean().optional(),
  action: z.boolean().optional(),
  payload: z.boolean().optional(),
  error: z.boolean().optional(),
  webhookSubscriptionId: z.boolean().optional(),
  webhookSubscription: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionArgsObjectSchema)]).optional(),
  resourceId: z.boolean().optional()
}).strict();
export const WebhookEventSelectObjectSchema: z.ZodType<Prisma.WebhookEventSelect> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventSelect>;
export const WebhookEventSelectObjectZodSchema = makeSchema();
