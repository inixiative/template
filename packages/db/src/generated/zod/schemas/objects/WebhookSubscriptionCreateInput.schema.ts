import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema as UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateNestedOneWithoutWebhookSubscriptionsInput.schema';
import { OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateNestedOneWithoutWebhookSubscriptionsInput.schema';
import { WebhookEventCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema as WebhookEventCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema } from './WebhookEventCreateNestedManyWithoutWebhookSubscriptionInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  secret: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  user: z.lazy(() => UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  events: z.lazy(() => WebhookEventCreateNestedManyWithoutWebhookSubscriptionInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCreateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateInput>;
export const WebhookSubscriptionCreateInputObjectZodSchema = makeSchema();
