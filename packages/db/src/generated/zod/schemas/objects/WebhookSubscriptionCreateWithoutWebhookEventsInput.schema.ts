import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema as UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateNestedOneWithoutWebhookSubscriptionsInput.schema';
import { OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateNestedOneWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  user: z.lazy(() => UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCreateWithoutWebhookEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateWithoutWebhookEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateWithoutWebhookEventsInput>;
export const WebhookSubscriptionCreateWithoutWebhookEventsInputObjectZodSchema = makeSchema();
