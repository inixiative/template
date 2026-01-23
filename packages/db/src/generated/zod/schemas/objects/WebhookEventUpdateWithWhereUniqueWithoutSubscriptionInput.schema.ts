import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventUpdateWithoutSubscriptionInputObjectSchema as WebhookEventUpdateWithoutSubscriptionInputObjectSchema } from './WebhookEventUpdateWithoutSubscriptionInput.schema';
import { WebhookEventUncheckedUpdateWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedUpdateWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedUpdateWithoutSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => WebhookEventUpdateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedUpdateWithoutSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInput>;
export const WebhookEventUpdateWithWhereUniqueWithoutSubscriptionInputObjectZodSchema = makeSchema();
