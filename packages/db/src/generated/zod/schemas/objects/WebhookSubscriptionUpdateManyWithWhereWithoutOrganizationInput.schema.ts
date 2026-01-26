import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionScalarWhereInputObjectSchema as WebhookSubscriptionScalarWhereInputObjectSchema } from './WebhookSubscriptionScalarWhereInput.schema';
import { WebhookSubscriptionUpdateManyMutationInputObjectSchema as WebhookSubscriptionUpdateManyMutationInputObjectSchema } from './WebhookSubscriptionUpdateManyMutationInput.schema';
import { WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => WebhookSubscriptionUpdateManyMutationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateManyWithoutOrganizationInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInput>;
export const WebhookSubscriptionUpdateManyWithWhereWithoutOrganizationInputObjectZodSchema = makeSchema();
