import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionUpdateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUpdateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUpdateWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedUpdateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedUpdateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => WebhookSubscriptionUpdateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateWithoutOrganizationInputObjectSchema)]),
  create: z.union([z.lazy(() => WebhookSubscriptionCreateWithoutOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInput>;
export const WebhookSubscriptionUpsertWithWhereUniqueWithoutOrganizationInputObjectZodSchema = makeSchema();
