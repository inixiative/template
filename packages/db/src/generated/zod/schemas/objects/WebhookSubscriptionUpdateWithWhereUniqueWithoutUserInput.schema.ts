import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateWithoutUserInputObjectSchema as WebhookSubscriptionUpdateWithoutUserInputObjectSchema } from './WebhookSubscriptionUpdateWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutUserInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInput>;
export const WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
