import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCreateWithoutEventsInputObjectSchema as WebhookSubscriptionCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutEventsInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutEventsInput.schema';
import { WebhookSubscriptionUpsertWithoutEventsInputObjectSchema as WebhookSubscriptionUpsertWithoutEventsInputObjectSchema } from './WebhookSubscriptionUpsertWithoutEventsInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInputObjectSchema as WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInputObjectSchema } from './WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInput.schema';
import { WebhookSubscriptionUpdateWithoutEventsInputObjectSchema as WebhookSubscriptionUpdateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUpdateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutEventsInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema).optional(),
  upsert: z.lazy(() => WebhookSubscriptionUpsertWithoutEventsInputObjectSchema).optional(),
  connect: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUpdateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInput>;
export const WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInputObjectZodSchema = makeSchema();
