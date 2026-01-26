import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCountOutputTypeCountOrganizationUsersArgsObjectSchema as OrganizationCountOutputTypeCountOrganizationUsersArgsObjectSchema } from './OrganizationCountOutputTypeCountOrganizationUsersArgs.schema';
import { OrganizationCountOutputTypeCountTokensArgsObjectSchema as OrganizationCountOutputTypeCountTokensArgsObjectSchema } from './OrganizationCountOutputTypeCountTokensArgs.schema';
import { OrganizationCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema as OrganizationCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema } from './OrganizationCountOutputTypeCountWebhookSubscriptionsArgs.schema';
import { OrganizationCountOutputTypeCountInquiriesSentArgsObjectSchema as OrganizationCountOutputTypeCountInquiriesSentArgsObjectSchema } from './OrganizationCountOutputTypeCountInquiriesSentArgs.schema';
import { OrganizationCountOutputTypeCountInquiriesReceivedArgsObjectSchema as OrganizationCountOutputTypeCountInquiriesReceivedArgsObjectSchema } from './OrganizationCountOutputTypeCountInquiriesReceivedArgs.schema'

const makeSchema = () => z.object({
  organizationUsers: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountOrganizationUsersArgsObjectSchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountTokensArgsObjectSchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountWebhookSubscriptionsArgsObjectSchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountInquiriesSentArgsObjectSchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeCountInquiriesReceivedArgsObjectSchema)]).optional()
}).strict();
export const OrganizationCountOutputTypeSelectObjectSchema: z.ZodType<Prisma.OrganizationCountOutputTypeSelect> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCountOutputTypeSelect>;
export const OrganizationCountOutputTypeSelectObjectZodSchema = makeSchema();
