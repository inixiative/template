import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  organizationId: z.string().optional().nullable(),
  webhookEvents: z.lazy(() => WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUncheckedCreateWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutUserInput>;
export const WebhookSubscriptionUncheckedCreateWithoutUserInputObjectZodSchema = makeSchema();
