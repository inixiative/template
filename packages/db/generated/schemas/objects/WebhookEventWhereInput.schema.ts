import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumWebhookEventStatusFilterObjectSchema as EnumWebhookEventStatusFilterObjectSchema } from './EnumWebhookEventStatusFilter.schema';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { EnumWebhookEventActionFilterObjectSchema as EnumWebhookEventActionFilterObjectSchema } from './EnumWebhookEventActionFilter.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { WebhookSubscriptionScalarRelationFilterObjectSchema as WebhookSubscriptionScalarRelationFilterObjectSchema } from './WebhookSubscriptionScalarRelationFilter.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema'

const webhookeventwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookEventWhereInputObjectSchema), z.lazy(() => WebhookEventWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookEventWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookEventWhereInputObjectSchema), z.lazy(() => WebhookEventWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  status: z.union([z.lazy(() => EnumWebhookEventStatusFilterObjectSchema), WebhookEventStatusSchema]).optional(),
  action: z.union([z.lazy(() => EnumWebhookEventActionFilterObjectSchema), WebhookEventActionSchema]).optional(),
  payload: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  error: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  webhookSubscriptionId: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  resourceId: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  webhookSubscription: z.union([z.lazy(() => WebhookSubscriptionScalarRelationFilterObjectSchema), z.lazy(() => WebhookSubscriptionWhereInputObjectSchema)]).optional()
}).strict();
export const WebhookEventWhereInputObjectSchema: z.ZodType<Prisma.WebhookEventWhereInput> = webhookeventwhereinputSchema as unknown as z.ZodType<Prisma.WebhookEventWhereInput>;
export const WebhookEventWhereInputObjectZodSchema = webhookeventwhereinputSchema;
