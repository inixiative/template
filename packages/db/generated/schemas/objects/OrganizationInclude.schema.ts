import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserFindManySchema as OrganizationUserFindManySchema } from '../findManyOrganizationUser.schema';
import { TokenFindManySchema as TokenFindManySchema } from '../findManyToken.schema';
import { WebhookSubscriptionFindManySchema as WebhookSubscriptionFindManySchema } from '../findManyWebhookSubscription.schema';
import { InquiryFindManySchema as InquiryFindManySchema } from '../findManyInquiry.schema';
import { OrganizationCountOutputTypeArgsObjectSchema as OrganizationCountOutputTypeArgsObjectSchema } from './OrganizationCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  users: z.union([z.boolean(), z.lazy(() => OrganizationUserFindManySchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => TokenFindManySchema)]).optional(),
  webhookSubscriptions: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionFindManySchema)]).optional(),
  inquiriesSent: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  inquiriesReceived: z.union([z.boolean(), z.lazy(() => InquiryFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => OrganizationCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const OrganizationIncludeObjectSchema: z.ZodType<Prisma.OrganizationInclude> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationInclude>;
export const OrganizationIncludeObjectZodSchema = makeSchema();
