import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCountOutputTypeCountUsersArgsObjectSchema as OrganizationCountOutputTypeCountUsersArgsObjectSchema } from './OrganizationCountOutputTypeCountUsersArgs.schema';
import { OrganizationCountOutputTypeCountTokensArgsObjectSchema as OrganizationCountOutputTypeCountTokensArgsObjectSchema } from './OrganizationCountOutputTypeCountTokensArgs.schema';
import { OrganizationCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema as OrganizationCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema } from './OrganizationCountOutputTypeCountWebhookSubscriptionsArgs.schema';
import { OrganizationCountOutputTypeCountInquiriesSentArgsObjectSchema as OrganizationCountOutputTypeCountInquiriesSentArgsObjectSchema } from './OrganizationCountOutputTypeCountInquiriesSentArgs.schema';
import { OrganizationCountOutputTypeCountInquiriesReceivedArgsObjectSchema as OrganizationCountOutputTypeCountInquiriesReceivedArgsObjectSchema } from './OrganizationCountOutputTypeCountInquiriesReceivedArgs.schema'

const makeSchema = () => z.object({
  users: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountUsersArgsObjectSchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountTokensArgsObjectSchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountInquiriesSentArgsObjectSchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountInquiriesReceivedArgsObjectSchema)]).optional()
}).strict();
export const OrganizationCountOutputTypeSelectObjectSchema: z.ZodType<Prisma.OrganizationCountOutputTypeSelect> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCountOutputTypeSelect>;
export const OrganizationCountOutputTypeSelectObjectZodSchema = makeSchema();
