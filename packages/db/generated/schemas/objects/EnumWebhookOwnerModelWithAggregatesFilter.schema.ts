import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { NestedEnumWebhookOwnerModelWithAggregatesFilterObjectSchema as NestedEnumWebhookOwnerModelWithAggregatesFilterObjectSchema } from './NestedEnumWebhookOwnerModelWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookOwnerModelFilterObjectSchema as NestedEnumWebhookOwnerModelFilterObjectSchema } from './NestedEnumWebhookOwnerModelFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookOwnerModelSchema.optional(),
  in: WebhookOwnerModelSchema.array().optional(),
  notIn: WebhookOwnerModelSchema.array().optional(),
  not: z.union([WebhookOwnerModelSchema, z.lazy(() => NestedEnumWebhookOwnerModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookOwnerModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookOwnerModelFilterObjectSchema).optional()
}).strict();
export const EnumWebhookOwnerModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumWebhookOwnerModelWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookOwnerModelWithAggregatesFilter>;
export const EnumWebhookOwnerModelWithAggregatesFilterObjectZodSchema = makeSchema();
