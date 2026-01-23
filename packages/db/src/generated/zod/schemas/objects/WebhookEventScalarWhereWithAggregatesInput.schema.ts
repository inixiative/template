import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { EnumWebhookEventStatusWithAggregatesFilterObjectSchema as EnumWebhookEventStatusWithAggregatesFilterObjectSchema } from './EnumWebhookEventStatusWithAggregatesFilter.schema';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { EnumWebhookEventActionWithAggregatesFilterObjectSchema as EnumWebhookEventActionWithAggregatesFilterObjectSchema } from './EnumWebhookEventActionWithAggregatesFilter.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { JsonNullableWithAggregatesFilterObjectSchema as JsonNullableWithAggregatesFilterObjectSchema } from './JsonNullableWithAggregatesFilter.schema';
import { StringNullableWithAggregatesFilterObjectSchema as StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema'

const webhookeventscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookEventScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => WebhookEventScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookEventScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookEventScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => WebhookEventScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  status: z.union([z.lazy(() => EnumWebhookEventStatusWithAggregatesFilterObjectSchema), WebhookEventStatusSchema]).optional(),
  action: z.union([z.lazy(() => EnumWebhookEventActionWithAggregatesFilterObjectSchema), WebhookEventActionSchema]).optional(),
  payload: z.lazy(() => JsonNullableWithAggregatesFilterObjectSchema).optional(),
  error: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string()]).optional().nullable(),
  subscriptionId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  resourceId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional()
}).strict();
export const WebhookEventScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.WebhookEventScalarWhereWithAggregatesInput> = webhookeventscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.WebhookEventScalarWhereWithAggregatesInput>;
export const WebhookEventScalarWhereWithAggregatesInputObjectZodSchema = webhookeventscalarwherewithaggregatesinputSchema;
