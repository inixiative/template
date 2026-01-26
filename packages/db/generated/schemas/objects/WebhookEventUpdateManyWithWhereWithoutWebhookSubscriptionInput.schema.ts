import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventScalarWhereInputObjectSchema as WebhookEventScalarWhereInputObjectSchema } from './WebhookEventScalarWhereInput.schema';
import { WebhookEventUpdateManyMutationInputObjectSchema as WebhookEventUpdateManyMutationInputObjectSchema } from './WebhookEventUpdateManyMutationInput.schema';
import { WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => WebhookEventUpdateManyMutationInputObjectSchema), z.lazy(() => WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInput>;
export const WebhookEventUpdateManyWithWhereWithoutWebhookSubscriptionInputObjectZodSchema = makeSchema();
