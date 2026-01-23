import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { EnumWebhookModelWithAggregatesFilterObjectSchema as EnumWebhookModelWithAggregatesFilterObjectSchema } from './EnumWebhookModelWithAggregatesFilter.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { StringNullableWithAggregatesFilterObjectSchema as StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema';
import { BoolWithAggregatesFilterObjectSchema as BoolWithAggregatesFilterObjectSchema } from './BoolWithAggregatesFilter.schema';
import { EnumWebhookOwnerTypeWithAggregatesFilterObjectSchema as EnumWebhookOwnerTypeWithAggregatesFilterObjectSchema } from './EnumWebhookOwnerTypeWithAggregatesFilter.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema'

const webhooksubscriptionscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookSubscriptionScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => WebhookSubscriptionScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookSubscriptionScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookSubscriptionScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => WebhookSubscriptionScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  model: z.union([z.lazy(() => EnumWebhookModelWithAggregatesFilterObjectSchema), WebhookModelSchema]).optional(),
  url: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(512)]).optional(),
  secret: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(255)]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolWithAggregatesFilterObjectSchema), z.boolean()]).optional(),
  ownerType: z.union([z.lazy(() => EnumWebhookOwnerTypeWithAggregatesFilterObjectSchema), WebhookOwnerTypeSchema]).optional(),
  ownerId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional()
}).strict();
export const WebhookSubscriptionScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionScalarWhereWithAggregatesInput> = webhooksubscriptionscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.WebhookSubscriptionScalarWhereWithAggregatesInput>;
export const WebhookSubscriptionScalarWhereWithAggregatesInputObjectZodSchema = webhooksubscriptionscalarwherewithaggregatesinputSchema;
