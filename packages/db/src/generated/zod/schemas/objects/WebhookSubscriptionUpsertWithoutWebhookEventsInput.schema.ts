import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUpdateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema)]),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema)]),
  where: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUpsertWithoutWebhookEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpsertWithoutWebhookEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpsertWithoutWebhookEventsInput>;
export const WebhookSubscriptionUpsertWithoutWebhookEventsInputObjectZodSchema = makeSchema();
