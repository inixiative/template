import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const WebhookSubscriptionOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionOrderByRelationAggregateInput>;
export const WebhookSubscriptionOrderByRelationAggregateInputObjectZodSchema = makeSchema();
