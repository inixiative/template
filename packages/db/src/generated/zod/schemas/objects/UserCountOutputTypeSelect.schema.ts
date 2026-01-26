import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCountOutputTypeCountAccountsArgsObjectSchema as UserCountOutputTypeCountAccountsArgsObjectSchema } from './UserCountOutputTypeCountAccountsArgs.schema';
import { UserCountOutputTypeCountSessionsArgsObjectSchema as UserCountOutputTypeCountSessionsArgsObjectSchema } from './UserCountOutputTypeCountSessionsArgs.schema';
import { UserCountOutputTypeCountOrganizationsArgsObjectSchema as UserCountOutputTypeCountOrganizationsArgsObjectSchema } from './UserCountOutputTypeCountOrganizationsArgs.schema';
import { UserCountOutputTypeCountTokensArgsObjectSchema as UserCountOutputTypeCountTokensArgsObjectSchema } from './UserCountOutputTypeCountTokensArgs.schema';
import { UserCountOutputTypeCountCronJobsCreatedArgsObjectSchema as UserCountOutputTypeCountCronJobsCreatedArgsObjectSchema } from './UserCountOutputTypeCountCronJobsCreatedArgs.schema';
import { UserCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema as UserCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema } from './UserCountOutputTypeCountWebhookSubscriptionsArgs.schema';
import { UserCountOutputTypeCountInquiriesSentArgsObjectSchema as UserCountOutputTypeCountInquiriesSentArgsObjectSchema } from './UserCountOutputTypeCountInquiriesSentArgs.schema';
import { UserCountOutputTypeCountInquiriesReceivedArgsObjectSchema as UserCountOutputTypeCountInquiriesReceivedArgsObjectSchema } from './UserCountOutputTypeCountInquiriesReceivedArgs.schema'

const makeSchema = () => z.object({
  accounts: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountAccountsArgsObjectSchema)]).optional(),
  sessions: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountSessionsArgsObjectSchema)]).optional(),
  organizations: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountOrganizationsArgsObjectSchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountTokensArgsObjectSchema)]).optional(),
  cronJobsCreated: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountCronJobsCreatedArgsObjectSchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountInquiriesSentArgsObjectSchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => UserCountOutputTypeCountInquiriesReceivedArgsObjectSchema)]).optional()
}).strict();
export const UserCountOutputTypeSelectObjectSchema: z.ZodType<Prisma.UserCountOutputTypeSelect> = makeSchema() as unknown as z.ZodType<Prisma.UserCountOutputTypeSelect>;
export const UserCountOutputTypeSelectObjectZodSchema = makeSchema();
