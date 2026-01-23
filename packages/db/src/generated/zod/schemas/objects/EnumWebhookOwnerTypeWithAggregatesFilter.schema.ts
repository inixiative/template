import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { NestedEnumWebhookOwnerTypeWithAggregatesFilterObjectSchema as NestedEnumWebhookOwnerTypeWithAggregatesFilterObjectSchema } from './NestedEnumWebhookOwnerTypeWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookOwnerTypeFilterObjectSchema as NestedEnumWebhookOwnerTypeFilterObjectSchema } from './NestedEnumWebhookOwnerTypeFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookOwnerTypeSchema.optional(),
  in: WebhookOwnerTypeSchema.array().optional(),
  notIn: WebhookOwnerTypeSchema.array().optional(),
  not: z.union([WebhookOwnerTypeSchema, z.lazy(() => NestedEnumWebhookOwnerTypeWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookOwnerTypeFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookOwnerTypeFilterObjectSchema).optional()
}).strict();
export const EnumWebhookOwnerTypeWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumWebhookOwnerTypeWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookOwnerTypeWithAggregatesFilter>;
export const EnumWebhookOwnerTypeWithAggregatesFilterObjectZodSchema = makeSchema();
