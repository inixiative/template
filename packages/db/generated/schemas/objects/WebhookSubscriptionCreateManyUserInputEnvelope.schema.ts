import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionCreateManyUserInputObjectSchema as WebhookSubscriptionCreateManyUserInputObjectSchema } from './WebhookSubscriptionCreateManyUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => WebhookSubscriptionCreateManyUserInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateManyUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyUserInputEnvelope>;
export const WebhookSubscriptionCreateManyUserInputEnvelopeObjectZodSchema = makeSchema();
