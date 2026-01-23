import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventScalarWhereInputObjectSchema as WebhookEventScalarWhereInputObjectSchema } from './WebhookEventScalarWhereInput.schema';
import { WebhookEventUpdateManyMutationInputObjectSchema as WebhookEventUpdateManyMutationInputObjectSchema } from './WebhookEventUpdateManyMutationInput.schema';
import { WebhookEventUncheckedUpdateManyWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedUpdateManyWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedUpdateManyWithoutSubscriptionInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookEventScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => WebhookEventUpdateManyMutationInputObjectSchema), z.lazy(() => WebhookEventUncheckedUpdateManyWithoutSubscriptionInputObjectSchema)])
}).strict();
export const WebhookEventUpdateManyWithWhereWithoutSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUpdateManyWithWhereWithoutSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpdateManyWithWhereWithoutSubscriptionInput>;
export const WebhookEventUpdateManyWithWhereWithoutSubscriptionInputObjectZodSchema = makeSchema();
