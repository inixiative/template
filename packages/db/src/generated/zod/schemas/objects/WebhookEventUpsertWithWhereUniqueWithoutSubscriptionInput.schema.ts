import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventUpdateWithoutSubscriptionInputObjectSchema as WebhookEventUpdateWithoutSubscriptionInputObjectSchema } from './WebhookEventUpdateWithoutSubscriptionInput.schema';
import { WebhookEventUncheckedUpdateWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedUpdateWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedUpdateWithoutSubscriptionInput.schema';
import { WebhookEventCreateWithoutSubscriptionInputObjectSchema as WebhookEventCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => WebhookEventUpdateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedUpdateWithoutSubscriptionInputObjectSchema)]),
  create: z.union([z.lazy(() => WebhookEventCreateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInput>;
export const WebhookEventUpsertWithWhereUniqueWithoutSubscriptionInputObjectZodSchema = makeSchema();
