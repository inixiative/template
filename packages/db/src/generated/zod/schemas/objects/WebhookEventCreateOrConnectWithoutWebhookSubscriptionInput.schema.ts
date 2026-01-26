import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventCreateOrConnectWithoutWebhookSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCreateOrConnectWithoutWebhookSubscriptionInput>;
export const WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectZodSchema = makeSchema();
