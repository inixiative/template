import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventCreateWithoutSubscriptionInputObjectSchema as WebhookEventCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutSubscriptionInput.schema';
import { WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema as WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateOrConnectWithoutSubscriptionInput.schema';
import { WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInputObjectSchema as WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInputObjectSchema } from './WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInput.schema';
import { WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema as WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema } from './WebhookEventCreateManySubscriptionInputEnvelope.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInputObjectSchema as WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInputObjectSchema } from './WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInput.schema';
import { WebhookEventUpdateManyWithWhereWithoutSubscriptionInputObjectSchema as WebhookEventUpdateManyWithWhereWithoutSubscriptionInputObjectSchema } from './WebhookEventUpdateManyWithWhereWithoutSubscriptionInput.schema';
import { WebhookEventScalarWhereInputObjectSchema as WebhookEventScalarWhereInputObjectSchema } from './WebhookEventScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookEventCreateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateWithoutSubscriptionInputObjectSchema).array(), z.lazy(() => WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => WebhookEventUpdateManyWithWhereWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUpdateManyWithWhereWithoutSubscriptionInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => WebhookEventScalarWhereInputObjectSchema), z.lazy(() => WebhookEventScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const WebhookEventUncheckedUpdateManyWithoutSubscriptionNestedInputObjectSchema: z.ZodType<Prisma.WebhookEventUncheckedUpdateManyWithoutSubscriptionNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUncheckedUpdateManyWithoutSubscriptionNestedInput>;
export const WebhookEventUncheckedUpdateManyWithoutSubscriptionNestedInputObjectZodSchema = makeSchema();
