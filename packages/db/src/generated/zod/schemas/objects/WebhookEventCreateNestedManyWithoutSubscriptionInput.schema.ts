import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventCreateWithoutSubscriptionInputObjectSchema as WebhookEventCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutSubscriptionInput.schema';
import { WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema as WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateOrConnectWithoutSubscriptionInput.schema';
import { WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema as WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema } from './WebhookEventCreateManySubscriptionInputEnvelope.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookEventCreateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateWithoutSubscriptionInputObjectSchema).array(), z.lazy(() => WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookEventCreateManySubscriptionInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => WebhookEventWhereUniqueInputObjectSchema), z.lazy(() => WebhookEventWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const WebhookEventCreateNestedManyWithoutSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventCreateNestedManyWithoutSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCreateNestedManyWithoutSubscriptionInput>;
export const WebhookEventCreateNestedManyWithoutSubscriptionInputObjectZodSchema = makeSchema();
