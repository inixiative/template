import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const WebhookEventOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventOrderByRelationAggregateInput>;
export const WebhookEventOrderByRelationAggregateInputObjectZodSchema = makeSchema();
