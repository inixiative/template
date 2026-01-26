import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionCreateWithoutUserInputObjectSchema as WebhookSubscriptionCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutUserInput>;
export const WebhookSubscriptionCreateOrConnectWithoutUserInputObjectZodSchema = makeSchema();
