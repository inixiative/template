import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumWebhookModelFilterObjectSchema as EnumWebhookModelFilterObjectSchema } from './EnumWebhookModelFilter.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { EnumWebhookOwnerTypeFilterObjectSchema as EnumWebhookOwnerTypeFilterObjectSchema } from './EnumWebhookOwnerTypeFilter.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { WebhookEventListRelationFilterObjectSchema as WebhookEventListRelationFilterObjectSchema } from './WebhookEventListRelationFilter.schema'

const webhooksubscriptionwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookSubscriptionWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookSubscriptionWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  model: z.union([z.lazy(() => EnumWebhookModelFilterObjectSchema), WebhookModelSchema]).optional(),
  url: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(512)]).optional(),
  secret: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(255)]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  ownerType: z.union([z.lazy(() => EnumWebhookOwnerTypeFilterObjectSchema), WebhookOwnerTypeSchema]).optional(),
  ownerId: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  events: z.lazy(() => WebhookEventListRelationFilterObjectSchema).optional()
}).strict();
export const WebhookSubscriptionWhereInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionWhereInput> = webhooksubscriptionwhereinputSchema as unknown as z.ZodType<Prisma.WebhookSubscriptionWhereInput>;
export const WebhookSubscriptionWhereInputObjectZodSchema = webhooksubscriptionwhereinputSchema;
