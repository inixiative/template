import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateOrConnectWithoutWebhookSubscriptionInput.schema';
import { WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema as WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema } from './WebhookEventCreateManyWebhookSubscriptionInputEnvelope.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema).array(), z.lazy(() => WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInput>;
export const WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectZodSchema = makeSchema();
