import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutOrganizationInput.schema';
import { WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema as WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema as WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema } from './WebhookSubscriptionCreateManyOrganizationInputEnvelope.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema as WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInput.schema';
import { WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInputObjectSchema as WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInput.schema';
import { WebhookSubscriptionScalarWhereInputObjectSchema as WebhookSubscriptionScalarWhereInputObjectSchema } from './WebhookSubscriptionScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema).array(), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationNestedInput>;
export const WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationNestedInputObjectZodSchema = makeSchema();
