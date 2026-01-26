import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookEventActionFilterObjectSchema as NestedEnumWebhookEventActionFilterObjectSchema } from './NestedEnumWebhookEventActionFilter.schema'

const nestedenumwebhookeventactionwithaggregatesfilterSchema = z.object({
  equals: WebhookEventActionSchema.optional(),
  in: WebhookEventActionSchema.array().optional(),
  notIn: WebhookEventActionSchema.array().optional(),
  not: z.union([WebhookEventActionSchema, z.lazy(() => NestedEnumWebhookEventActionWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookEventActionFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookEventActionFilterObjectSchema).optional()
}).strict();
export const NestedEnumWebhookEventActionWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookEventActionWithAggregatesFilter> = nestedenumwebhookeventactionwithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookEventActionWithAggregatesFilter>;
export const NestedEnumWebhookEventActionWithAggregatesFilterObjectZodSchema = nestedenumwebhookeventactionwithaggregatesfilterSchema;
