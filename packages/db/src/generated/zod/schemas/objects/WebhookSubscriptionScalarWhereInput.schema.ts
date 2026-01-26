import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumWebhookModelFilterObjectSchema as EnumWebhookModelFilterObjectSchema } from './EnumWebhookModelFilter.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { EnumWebhookOwnerModelFilterObjectSchema as EnumWebhookOwnerModelFilterObjectSchema } from './EnumWebhookOwnerModelFilter.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema'

const webhooksubscriptionscalarwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionScalarWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  model: z.union([z.lazy(() => EnumWebhookModelFilterObjectSchema), WebhookModelSchema]).optional(),
  url: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  secret: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  ownerModel: z.union([z.lazy(() => EnumWebhookOwnerModelFilterObjectSchema), WebhookOwnerModelSchema]).optional(),
  userId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  organizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable()
}).strict();
export const WebhookSubscriptionScalarWhereInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionScalarWhereInput> = webhooksubscriptionscalarwhereinputSchema as unknown as z.ZodType<Prisma.WebhookSubscriptionScalarWhereInput>;
export const WebhookSubscriptionScalarWhereInputObjectZodSchema = webhooksubscriptionscalarwhereinputSchema;
