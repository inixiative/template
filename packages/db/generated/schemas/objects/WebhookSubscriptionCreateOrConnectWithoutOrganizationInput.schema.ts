import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema)])
}).strict();
export const WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateOrConnectWithoutOrganizationInput>;
export const WebhookSubscriptionCreateOrConnectWithoutOrganizationInputObjectZodSchema = makeSchema();
