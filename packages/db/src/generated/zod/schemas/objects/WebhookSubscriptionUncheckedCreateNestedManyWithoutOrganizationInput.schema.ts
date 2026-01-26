import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateOrConnectWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema as WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema } from './WebhookSubscriptionCreateManyOrganizationInputEnvelope.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema).array(), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInput>;
export const WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectZodSchema = makeSchema();
