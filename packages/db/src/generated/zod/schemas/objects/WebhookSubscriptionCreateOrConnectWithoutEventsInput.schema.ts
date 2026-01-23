import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionCreateWithoutEventsInputObjectSchema as WebhookSubscriptionCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutEventsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema)])
}).strict();
export const WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutEventsInput>;
export const WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectZodSchema = makeSchema();
