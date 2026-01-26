import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutWebhookSubscriptionInput.schema';
import { WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateOrConnectWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInput.schema';
import { WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema as WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema } from './WebhookEventCreateManyWebhookSubscriptionInputEnvelope.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInput.schema';
import { WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInput.schema';
import { WebhookEventScalarWhereInputObjectSchema as WebhookEventScalarWhereInputObjectSchema } from './WebhookEventScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateWithoutWebhookSubscriptionInputObjectSchema).array(), z.lazy(() => WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateOrConnectWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUpsertWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookEventCreateManyWebhookSubscriptionInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUpdateWithWhereUniqueWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => WebhookEventScalarWhereInputObjectSchema), z.lazy(() => WebhookEventScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema: z.ZodType<Prisma.WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInput>;
export const WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInputObjectZodSchema = makeSchema();
