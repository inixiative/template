import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUpdateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUpdateWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutOrganizationInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInput>;
export const WebhookSubscriptionUpdateWithWhereUniqueWithoutOrganizationInputObjectZodSchema = makeSchema();
