import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema';
import { WebhookEventFindManySchema as WebhookEventFindManySchema } from '../findManyWebhookEvent.schema';
import { WebhookSubscriptionCountOutputTypeArgsObjectSchema as WebhookSubscriptionCountOutputTypeArgsObjectSchema } from './WebhookSubscriptionCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  model: z.boolean().optional(),
  url: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ownerModel: z.boolean().optional(),
  userId: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  user: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  organization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  webhookEvents: z.union([z.boolean(), z.lazy(() => WebhookEventFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionSelectObjectSchema: z.ZodType<Prisma.WebhookSubscriptionSelect> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionSelect>;
export const WebhookSubscriptionSelectObjectZodSchema = makeSchema();
