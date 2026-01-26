import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventUpdateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUpdateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUpdateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => WebhookEventUpdateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInput>;
export const WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInputObjectZodSchema = makeSchema();
