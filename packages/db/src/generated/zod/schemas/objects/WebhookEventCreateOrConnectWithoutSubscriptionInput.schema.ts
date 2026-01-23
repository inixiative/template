import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './WebhookEventWhereUniqueInput.schema';
import { WebhookEventCreateWithoutSubscriptionInputObjectSchema as WebhookEventCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateWithoutSubscriptionInput.schema';
import { WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateWithoutSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WebhookEventCreateWithoutSubscriptionInputObjectSchema), z.lazy(() => WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventCreateOrConnectWithoutSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventCreateOrConnectWithoutSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCreateOrConnectWithoutSubscriptionInput>;
export const WebhookEventCreateOrConnectWithoutSubscriptionInputObjectZodSchema = makeSchema();
