import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { AccountFindManySchema as AccountFindManySchema } from '../findManyAccount.schema';
import { SessionFindManySchema as SessionFindManySchema } from '../findManySession.schema';
import { OrganizationUserFindManySchema as OrganizationUserFindManySchema } from '../findManyOrganizationUser.schema';
import { TokenFindManySchema as TokenFindManySchema } from '../findManyToken.schema';
import { CronJobFindManySchema as CronJobFindManySchema } from '../findManyCronJob.schema';
import { WebhookSubscriptionFindManySchema as WebhookSubscriptionFindManySchema } from '../findManyWebhookSubscription.schema';
import { InquiryFindManySchema as InquiryFindManySchema } from '../findManyInquiry.schema';
import { UserCountOutputTypeArgsObjectSchema as UserCountOutputTypeArgsObjectSchema } from './UserCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  deletedAt: z.boolean().optional(),
  email: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  name: z.boolean().optional(),
  image: z.boolean().optional(),
  platformRole: z.boolean().optional(),
  accounts: z.union([z.boolean(), z.lazy(() => AccountFindManySchema)]).optional(),
  sessions: z.union([z.boolean(), z.lazy(() => SessionFindManySchema)]).optional(),
  organizations: z.union([z.boolean(), z.lazy(() => OrganizationUserFindManySchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => TokenFindManySchema)]).optional(),
  cronJobsCreated: z.union([z.boolean(), z.lazy(() => CronJobFindManySchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionFindManySchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const UserSelectObjectSchema: z.ZodType<Prisma.UserSelect> = makeSchema() as unknown as z.ZodType<Prisma.UserSelect>;
export const UserSelectObjectZodSchema = makeSchema();
