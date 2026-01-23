import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './WebhookSubscriptionWhereInput.schema'

const makeSchema = () => z.object({
  is: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional(),
  isNot: z.lazy(() => WebhookSubscriptionWhereInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionScalarRelationFilterObjectSchema: z.ZodType<Prisma.WebhookSubscriptionScalarRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionScalarRelationFilter>;
export const WebhookSubscriptionScalarRelationFilterObjectZodSchema = makeSchema();
