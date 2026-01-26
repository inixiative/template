import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventCreateManyWebhookSubscriptionInputObjectSchema as WebhookEventCreateManyWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateManyWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => WebhookEventCreateManyWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateManyWebhookSubscriptionInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema: z.ZodType<Prisma.WebhookEventCreateManyWebhookSubscriptionInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCreateManyWebhookSubscriptionInputEnvelope>;
export const WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectZodSchema = makeSchema();
