import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema';
import { WebhookSubscriptionUpdateWithoutEventsInputObjectSchema as WebhookSubscriptionUpdateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUpdateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutEventsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutEventsInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInput>;
export const WebhookSubscriptionUpdateToOneWithWhereWithoutEventsInputObjectZodSchema = makeSchema();
