import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema';
import { WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUpdateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInput>;
export const WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInputObjectZodSchema = makeSchema();
