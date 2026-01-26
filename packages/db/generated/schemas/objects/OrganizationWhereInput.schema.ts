import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { OrganizationUserListRelationFilterObjectSchema as OrganizationUserListRelationFilterObjectSchema } from './OrganizationUserListRelationFilter.schema';
import { TokenListRelationFilterObjectSchema as TokenListRelationFilterObjectSchema } from './TokenListRelationFilter.schema';
import { WebhookSubscriptionListRelationFilterObjectSchema as WebhookSubscriptionListRelationFilterObjectSchema } from './WebhookSubscriptionListRelationFilter.schema';
import { InquiryListRelationFilterObjectSchema as InquiryListRelationFilterObjectSchema } from './InquiryListRelationFilter.schema'

const organizationwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => OrganizationWhereInputObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => OrganizationWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => OrganizationWhereInputObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  deletedAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  name: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  slug: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  users: z.lazy(() => OrganizationUserListRelationFilterObjectSchema).optional(),
  tokens: z.lazy(() => TokenListRelationFilterObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionListRelationFilterObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryListRelationFilterObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryListRelationFilterObjectSchema).optional()
}).strict();
export const OrganizationWhereInputObjectSchema: z.ZodType<Prisma.OrganizationWhereInput> = organizationwhereinputSchema as unknown as z.ZodType<Prisma.OrganizationWhereInput>;
export const OrganizationWhereInputObjectZodSchema = organizationwhereinputSchema;
