import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumWebhookEventStatusFilterObjectSchema as EnumWebhookEventStatusFilterObjectSchema } from './EnumWebhookEventStatusFilter.schema';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { EnumWebhookEventActionFilterObjectSchema as EnumWebhookEventActionFilterObjectSchema } from './EnumWebhookEventActionFilter.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema'

const webhookeventscalarwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookEventScalarWhereInputObjectSchema), z.lazy(() => WebhookEventScalarWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookEventScalarWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookEventScalarWhereInputObjectSchema), z.lazy(() => WebhookEventScalarWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  status: z.union([z.lazy(() => EnumWebhookEventStatusFilterObjectSchema), WebhookEventStatusSchema]).optional(),
  action: z.union([z.lazy(() => EnumWebhookEventActionFilterObjectSchema), WebhookEventActionSchema]).optional(),
  payload: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  error: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  subscriptionId: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  resourceId: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional()
}).strict();
export const WebhookEventScalarWhereInputObjectSchema: z.ZodType<Prisma.WebhookEventScalarWhereInput> = webhookeventscalarwhereinputSchema as unknown as z.ZodType<Prisma.WebhookEventScalarWhereInput>;
export const WebhookEventScalarWhereInputObjectZodSchema = webhookeventscalarwhereinputSchema;
