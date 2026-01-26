import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { AccountOrderByRelationAggregateInputObjectSchema as AccountOrderByRelationAggregateInputObjectSchema } from './AccountOrderByRelationAggregateInput.schema';
import { SessionOrderByRelationAggregateInputObjectSchema as SessionOrderByRelationAggregateInputObjectSchema } from './SessionOrderByRelationAggregateInput.schema';
import { OrganizationUserOrderByRelationAggregateInputObjectSchema as OrganizationUserOrderByRelationAggregateInputObjectSchema } from './OrganizationUserOrderByRelationAggregateInput.schema';
import { TokenOrderByRelationAggregateInputObjectSchema as TokenOrderByRelationAggregateInputObjectSchema } from './TokenOrderByRelationAggregateInput.schema';
import { CronJobOrderByRelationAggregateInputObjectSchema as CronJobOrderByRelationAggregateInputObjectSchema } from './CronJobOrderByRelationAggregateInput.schema';
import { WebhookSubscriptionOrderByRelationAggregateInputObjectSchema as WebhookSubscriptionOrderByRelationAggregateInputObjectSchema } from './WebhookSubscriptionOrderByRelationAggregateInput.schema';
import { InquiryOrderByRelationAggregateInputObjectSchema as InquiryOrderByRelationAggregateInputObjectSchema } from './InquiryOrderByRelationAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  deletedAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  email: SortOrderSchema.optional(),
  emailVerified: SortOrderSchema.optional(),
  name: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  image: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  platformRole: SortOrderSchema.optional(),
  accounts: z.lazy(() => AccountOrderByRelationAggregateInputObjectSchema).optional(),
  sessions: z.lazy(() => SessionOrderByRelationAggregateInputObjectSchema).optional(),
  organizations: z.lazy(() => OrganizationUserOrderByRelationAggregateInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenOrderByRelationAggregateInputObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobOrderByRelationAggregateInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionOrderByRelationAggregateInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryOrderByRelationAggregateInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryOrderByRelationAggregateInputObjectSchema).optional()
}).strict();
export const UserOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.UserOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.UserOrderByWithRelationInput>;
export const UserOrderByWithRelationInputObjectZodSchema = makeSchema();
