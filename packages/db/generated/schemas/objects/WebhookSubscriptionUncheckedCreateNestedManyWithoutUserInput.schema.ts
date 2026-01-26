import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionCreateWithoutUserInputObjectSchema as WebhookSubscriptionCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutUserInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutUserInput.schema';
import { WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema as WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema } from './WebhookSubscriptionCreateManyUserInputEnvelope.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateWithoutUserInputObjectSchema).array(), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInput>;
export const WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectZodSchema = makeSchema();
