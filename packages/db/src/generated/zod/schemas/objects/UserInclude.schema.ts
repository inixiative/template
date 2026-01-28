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
  accounts: z.union([z.boolean(), z.lazy(() => AccountFindManySchema)]).optional(),
  sessions: z.union([z.boolean(), z.lazy(() => SessionFindManySchema)]).optional(),
  organizationUsers: z.union([z.boolean(), z.lazy(() => OrganizationUserFindManySchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => TokenFindManySchema)]).optional(),
  cronJobsCreated: z.union([z.boolean(), z.lazy(() => CronJobFindManySchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionFindManySchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const UserIncludeObjectSchema: z.ZodType<Prisma.UserInclude> = makeSchema() as unknown as z.ZodType<Prisma.UserInclude>;
export const UserIncludeObjectZodSchema = makeSchema();
