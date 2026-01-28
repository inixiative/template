import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema).optional(),
  connect: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCreateNestedOneWithoutWebhookEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateNestedOneWithoutWebhookEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateNestedOneWithoutWebhookEventsInput>;
export const WebhookSubscriptionCreateNestedOneWithoutWebhookEventsInputObjectZodSchema = makeSchema();
