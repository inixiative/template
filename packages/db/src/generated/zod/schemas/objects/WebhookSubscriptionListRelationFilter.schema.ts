import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional(),
  some: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional(),
  none: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionListRelationFilterObjectSchema: z.ZodType<Prisma.WebhookSubscriptionListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionListRelationFilter>;
export const WebhookSubscriptionListRelationFilterObjectZodSchema = makeSchema();
