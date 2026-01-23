import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookEventStatusFilterObjectSchema as NestedEnumWebhookEventStatusFilterObjectSchema } from './NestedEnumWebhookEventStatusFilter.schema'

const nestedenumwebhookeventstatuswithaggregatesfilterSchema = z.object({
  equals: WebhookEventStatusSchema.optional(),
  in: WebhookEventStatusSchema.array().optional(),
  notIn: WebhookEventStatusSchema.array().optional(),
  not: z.union([WebhookEventStatusSchema, z.lazy(() => NestedEnumWebhookEventStatusWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookEventStatusFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookEventStatusFilterObjectSchema).optional()
}).strict();
export const NestedEnumWebhookEventStatusWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookEventStatusWithAggregatesFilter> = nestedenumwebhookeventstatuswithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookEventStatusWithAggregatesFilter>;
export const NestedEnumWebhookEventStatusWithAggregatesFilterObjectZodSchema = nestedenumwebhookeventstatuswithaggregatesfilterSchema;
