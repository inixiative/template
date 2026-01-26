import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionScalarWhereInputObjectSchema as WebhookSubscriptionScalarWhereInputObjectSchema } from './WebhookSubscriptionScalarWhereInput.schema';
import { WebhookSubscriptionUpdateManyMutationInputObjectSchema as WebhookSubscriptionUpdateManyMutationInputObjectSchema } from './WebhookSubscriptionUpdateManyMutationInput.schema';
import { WebhookSubscriptionUncheckedUpdateManyWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedUpdateManyWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateManyWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => WebhookSubscriptionUpdateManyMutationInputObjectSchema), z.lazy(() => WebhookSubscriptionUncheckedUpdateManyWithoutUserInputObjectSchema)])
}).strict();
export const WebhookSubscriptionUpdateManyWithWhereWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateManyWithWhereWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateManyWithWhereWithoutUserInput>;
export const WebhookSubscriptionUpdateManyWithWhereWithoutUserInputObjectZodSchema = makeSchema();
