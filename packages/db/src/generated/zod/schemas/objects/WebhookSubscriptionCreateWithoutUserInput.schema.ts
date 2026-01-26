import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateNestedOneWithoutWebhookSubscriptionsInput.schema';
import { WebhookEventCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateNestedManyWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  secret: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  events: z.lazy(() => WebhookEventCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCreateWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateWithoutUserInput>;
export const WebhookSubscriptionCreateWithoutUserInputObjectZodSchema = makeSchema();
