import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventUpdateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUpdateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUpdateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => WebhookEventUpdateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedUpdateWithoutWebhookSubscriptionInputObjectSchema)]),
  create: z.union([z.lazy(() => WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInput>;
export const WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInputObjectZodSchema = makeSchema();
