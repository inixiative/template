import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { NestedEnumWebhookModelWithAggregatesFilterObjectSchema as NestedEnumWebhookModelWithAggregatesFilterObjectSchema } from './NestedEnumWebhookModelWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookModelFilterObjectSchema as NestedEnumWebhookModelFilterObjectSchema } from './NestedEnumWebhookModelFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookModelSchema.optional(),
  in: WebhookModelSchema.array().optional(),
  notIn: WebhookModelSchema.array().optional(),
  not: z.union([WebhookModelSchema, z.lazy(() => NestedEnumWebhookModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookModelFilterObjectSchema).optional()
}).strict();
export const EnumWebhookModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumWebhookModelWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookModelWithAggregatesFilter>;
export const EnumWebhookModelWithAggregatesFilterObjectZodSchema = makeSchema();
