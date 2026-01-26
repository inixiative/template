import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserFindManySchema as OrganizationUserFindManySchema } from '../findManyOrganizationUser.schema';
import { TokenFindManySchema as TokenFindManySchema } from '../findManyToken.schema';
import { WebhookSubscriptionFindManySchema as WebhookSubscriptionFindManySchema } from '../findManyWebhookSubscription.schema';
import { InquiryFindManySchema as InquiryFindManySchema } from '../findManyInquiry.schema';
import { OrganizationCountOutputTypeArgsObjectSchema as OrganizationCountOutputTypeArgsObjectSchema } from './OrganizationCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  deletedAt: z.boolean().optional(),
  name: z.boolean().optional(),
  slug: z.boolean().optional(),
  organizationUsers: z.union([z.boolean(), z.lazy(() => OrganizationUserFindManySchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => TokenFindManySchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionFindManySchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const OrganizationSelectObjectSchema: z.ZodType<Prisma.OrganizationSelect> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationSelect>;
export const OrganizationSelectObjectZodSchema = makeSchema();
