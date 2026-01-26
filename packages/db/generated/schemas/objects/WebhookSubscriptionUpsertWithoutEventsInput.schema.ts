import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionUpdateWithoutEventsInputObjectSchema as WebhookSubscriptionUpdateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUpdateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutEventsInput.schema';
import { WebhookSubscriptionCreateWithoutEventsInputObjectSchema as WebhookSubscriptionCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutEventsInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema)]),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema)]),
  where: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUpsertWithoutEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpsertWithoutEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpsertWithoutEventsInput>;
export const WebhookSubscriptionUpsertWithoutEventsInputObjectZodSchema = makeSchema();
