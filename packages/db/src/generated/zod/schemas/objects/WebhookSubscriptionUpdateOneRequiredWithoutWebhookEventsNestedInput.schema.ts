import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUpsertWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUpsertWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUpsertWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUpdateWithoutWebhookEventsInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutWebhookEventsInputObjectSchema).optional(),
  upsert: z.lazy(() => WebhookSubscriptionUpsertWithoutWebhookEventsInputObjectSchema).optional(),
  connect: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateToOneWithWhereWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUpdateWithoutWebhookEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutWebhookEventsInputObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionUpdateOneRequiredWithoutWebhookEventsNestedInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateOneRequiredWithoutWebhookEventsNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateOneRequiredWithoutWebhookEventsNestedInput>;
export const WebhookSubscriptionUpdateOneRequiredWithoutWebhookEventsNestedInputObjectZodSchema = makeSchema();
