import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { EnumPlatformRoleFilterObjectSchema as EnumPlatformRoleFilterObjectSchema } from './EnumPlatformRoleFilter.schema';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { AccountListRelationFilterObjectSchema as AccountListRelationFilterObjectSchema } from './AccountListRelationFilter.schema';
import { SessionListRelationFilterObjectSchema as SessionListRelationFilterObjectSchema } from './SessionListRelationFilter.schema';
import { OrganizationUserListRelationFilterObjectSchema as OrganizationUserListRelationFilterObjectSchema } from './OrganizationUserListRelationFilter.schema';
import { TokenListRelationFilterObjectSchema as TokenListRelationFilterObjectSchema } from './TokenListRelationFilter.schema';
import { CronJobListRelationFilterObjectSchema as CronJobListRelationFilterObjectSchema } from './CronJobListRelationFilter.schema';
import { WebhookSubscriptionListRelationFilterObjectSchema as WebhookSubscriptionListRelationFilterObjectSchema } from './WebhookSubscriptionListRelationFilter.schema';
import { InquiryListRelationFilterObjectSchema as InquiryListRelationFilterObjectSchema } from './InquiryListRelationFilter.schema'

const userwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => UserWhereInputObjectSchema), z.lazy(() => UserWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => UserWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => UserWhereInputObjectSchema), z.lazy(() => UserWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  deletedAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  email: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  emailVerified: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  name: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  displayName: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  image: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  platformRole: z.union([z.lazy(() => EnumPlatformRoleFilterObjectSchema), PlatformRoleSchema]).optional(),
  accounts: z.lazy(() => AccountListRelationFilterObjectSchema).optional(),
  sessions: z.lazy(() => SessionListRelationFilterObjectSchema).optional(),
  organizationUsers: z.lazy(() => OrganizationUserListRelationFilterObjectSchema).optional(),
  tokens: z.lazy(() => TokenListRelationFilterObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobListRelationFilterObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionListRelationFilterObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryListRelationFilterObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryListRelationFilterObjectSchema).optional()
}).strict();
export const UserWhereInputObjectSchema: z.ZodType<Prisma.UserWhereInput> = userwhereinputSchema as unknown as z.ZodType<Prisma.UserWhereInput>;
export const UserWhereInputObjectZodSchema = userwhereinputSchema;
