import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateWithoutUserInputObjectSchema as WebhookSubscriptionUpdateWithoutUserInputObjectSchema } from './WebhookSubscriptionUpdateWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutUserInput.schema';
import { WebhookSubscriptionCreateWithoutUserInputObjectSchema as WebhookSubscriptionCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutUserInputObjectSchema)]),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInput>;
export const WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
