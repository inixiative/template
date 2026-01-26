import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionCreateWithoutEventsInputObjectSchema as WebhookSubscriptionCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateWithoutEventsInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutEventsInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutEventsInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutEventsInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutEventsInputObjectSchema).optional(),
  connect: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCreateNestedOneWithoutEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateNestedOneWithoutEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateNestedOneWithoutEventsInput>;
export const WebhookSubscriptionCreateNestedOneWithoutEventsInputObjectZodSchema = makeSchema();
