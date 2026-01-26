import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumWebhookModelFilterObjectSchema as EnumWebhookModelFilterObjectSchema } from './EnumWebhookModelFilter.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { EnumWebhookOwnerModelFilterObjectSchema as EnumWebhookOwnerModelFilterObjectSchema } from './EnumWebhookOwnerModelFilter.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { UserNullableScalarRelationFilterObjectSchema as UserNullableScalarRelationFilterObjectSchema } from './UserNullableScalarRelationFilter.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { OrganizationNullableScalarRelationFilterObjectSchema as OrganizationNullableScalarRelationFilterObjectSchema } from './OrganizationNullableScalarRelationFilter.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { WebhookEventListRelationFilterObjectSchema as WebhookEventListRelationFilterObjectSchema } from './WebhookEventListRelationFilter.schema'

const webhooksubscriptionwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WebhookSubscriptionWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WebhookSubscriptionWhereInputObjectSchema), z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  model: z.union([z.lazy(() => EnumWebhookModelFilterObjectSchema), WebhookModelSchema]).optional(),
  url: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  secret: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  ownerModel: z.union([z.lazy(() => EnumWebhookOwnerModelFilterObjectSchema), WebhookOwnerModelSchema]).optional(),
  userId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  organizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  user: z.union([z.lazy(() => UserNullableScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  organization: z.union([z.lazy(() => OrganizationNullableScalarRelationFilterObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  events: z.lazy(() => WebhookEventListRelationFilterObjectSchema).optional()
}).strict();
export const WebhookSubscriptionWhereInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionWhereInput> = webhooksubscriptionwhereinputSchema as unknown as z.ZodType<Prisma.WebhookSubscriptionWhereInput>;
export const WebhookSubscriptionWhereInputObjectZodSchema = webhooksubscriptionwhereinputSchema;
