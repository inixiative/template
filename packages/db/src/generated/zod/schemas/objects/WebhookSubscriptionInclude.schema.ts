import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema';
import { WebhookEventFindManySchema as WebhookEventFindManySchema } from '../findManyWebhookEvent.schema';
import { WebhookSubscriptionCountOutputTypeArgsObjectSchema as WebhookSubscriptionCountOutputTypeArgsObjectSchema } from './WebhookSubscriptionCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  user: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  organization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  webhookEvents: z.union([z.boolean(), z.lazy(() => WebhookEventFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => WebhookSubscriptionCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionIncludeObjectSchema: z.ZodType<Prisma.WebhookSubscriptionInclude> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionInclude>;
export const WebhookSubscriptionIncludeObjectZodSchema = makeSchema();
