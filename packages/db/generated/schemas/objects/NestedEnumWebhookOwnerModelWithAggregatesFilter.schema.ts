import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumWebhookOwnerModelFilterObjectSchema as NestedEnumWebhookOwnerModelFilterObjectSchema } from './NestedEnumWebhookOwnerModelFilter.schema'

const nestedenumwebhookownermodelwithaggregatesfilterSchema = z.object({
  equals: WebhookOwnerModelSchema.optional(),
  in: WebhookOwnerModelSchema.array().optional(),
  notIn: WebhookOwnerModelSchema.array().optional(),
  not: z.union([WebhookOwnerModelSchema, z.lazy(() => NestedEnumWebhookOwnerModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumWebhookOwnerModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumWebhookOwnerModelFilterObjectSchema).optional()
}).strict();
export const NestedEnumWebhookOwnerModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookOwnerModelWithAggregatesFilter> = nestedenumwebhookownermodelwithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookOwnerModelWithAggregatesFilter>;
export const NestedEnumWebhookOwnerModelWithAggregatesFilterObjectZodSchema = nestedenumwebhookownermodelwithaggregatesfilterSchema;
