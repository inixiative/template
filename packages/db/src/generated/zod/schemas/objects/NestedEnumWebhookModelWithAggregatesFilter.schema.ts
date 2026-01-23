import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookModelFilterObjectSchema as NestedEnumWebhookModelFilterObjectSchema } from './NestedEnumWebhookModelFilter.schema'

const nestedenumwebhookmodelwithaggregatesfilterSchema = z.object({
  equals: WebhookModelSchema.optional(),
  in: WebhookModelSchema.array().optional(),
  notIn: WebhookModelSchema.array().optional(),
  not: z.union([WebhookModelSchema, z.lazy(() => NestedEnumWebhookModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookModelFilterObjectSchema).optional()
}).strict();
export const NestedEnumWebhookModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookModelWithAggregatesFilter> = nestedenumwebhookmodelwithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookModelWithAggregatesFilter>;
export const NestedEnumWebhookModelWithAggregatesFilterObjectZodSchema = nestedenumwebhookmodelwithaggregatesfilterSchema;
