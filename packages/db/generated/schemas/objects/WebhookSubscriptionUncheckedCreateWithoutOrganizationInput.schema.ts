import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema as WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  secret: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  userId: z.string().optional().nullable(),
  events: z.lazy(() => WebhookEventUncheckedCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutOrganizationInput>;
export const WebhookSubscriptionUncheckedCreateWithoutOrganizationInputObjectZodSchema = makeSchema();
