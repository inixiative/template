import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookOwnerTypeFilterObjectSchema as NestedEnumWebhookOwnerTypeFilterObjectSchema } from './NestedEnumWebhookOwnerTypeFilter.schema'

const nestedenumwebhookownertypewithaggregatesfilterSchema = z.object({
  equals: WebhookOwnerTypeSchema.optional(),
  in: WebhookOwnerTypeSchema.array().optional(),
  notIn: WebhookOwnerTypeSchema.array().optional(),
  not: z.union([WebhookOwnerTypeSchema, z.lazy(() => NestedEnumWebhookOwnerTypeWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookOwnerTypeFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookOwnerTypeFilterObjectSchema).optional()
}).strict();
export const NestedEnumWebhookOwnerTypeWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookOwnerTypeWithAggregatesFilter> = nestedenumwebhookownertypewithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookOwnerTypeWithAggregatesFilter>;
export const NestedEnumWebhookOwnerTypeWithAggregatesFilterObjectZodSchema = nestedenumwebhookownertypewithaggregatesfilterSchema;
