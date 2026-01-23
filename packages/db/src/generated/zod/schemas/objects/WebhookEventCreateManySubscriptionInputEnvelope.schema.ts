import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventCreateManySubscriptionInputObjectSchema as WebhookEventCreateManySubscriptionInputObjectSchema } from './WebhookEventCreateManySubscriptionInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => WebhookEventCreateManySubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateManySubscriptionInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema: z.ZodType<Prisma.WebhookEventCreateManySubscriptionInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCreateManySubscriptionInputEnvelope>;
export const WebhookEventCreateManySubscriptionInputEnvelopeObjectZodSchema = makeSchema();
