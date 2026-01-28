import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema)])
}).strict();
export const WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInput>;
export const WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectZodSchema = makeSchema();
