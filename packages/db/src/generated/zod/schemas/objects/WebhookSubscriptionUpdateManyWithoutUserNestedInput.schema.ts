import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCreateWithoutUserInputObjectSchema as WebhookSubscriptionCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutUserInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutUserInput.schema';
import { WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInputObjectSchema as WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInputObjectSchema } from './WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInput.schema';
import { WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema as WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema } from './WebhookSubscriptionCreateManyUserInputEnvelope.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInputObjectSchema as WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInputObjectSchema } from './WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInput.schema';
import { WebhookSubscriptionUpdateManyWithWhereWithoutUserInputObjectSchema as WebhookSubscriptionUpdateManyWithWhereWithoutUserInputObjectSchema } from './WebhookSubscriptionUpdateManyWithWhereWithoutUserInput.schema';
import { WebhookSubscriptionScalarWhereInputObjectSchema as WebhookSubscriptionScalarWhereInputObjectSchema } from './WebhookSubscriptionScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateWithoutUserInputObjectSchema).array(), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUpsertWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookSubscriptionCreateManyUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUpdateWithWhereUniqueWithoutUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => WebhookSubscriptionUpdateManyWithWhereWithoutUserInputObjectSchema), z.lazy(() => WebhookSubscriptionUpdateManyWithWhereWithoutUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const WebhookSubscriptionUpdateManyWithoutUserNestedInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateManyWithoutUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateManyWithoutUserNestedInput>;
export const WebhookSubscriptionUpdateManyWithoutUserNestedInputObjectZodSchema = makeSchema();
