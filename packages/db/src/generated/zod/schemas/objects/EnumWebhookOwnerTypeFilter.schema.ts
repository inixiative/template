import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { NestedEnumWebhookOwnerTypeFilterObjectSchema as NestedEnumWebhookOwnerTypeFilterObjectSchema } from './NestedEnumWebhookOwnerTypeFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookOwnerTypeSchema.optional(),
  in: WebhookOwnerTypeSchema.array().optional(),
  notIn: WebhookOwnerTypeSchema.array().optional(),
  not: z.union([WebhookOwnerTypeSchema, z.lazy(() => NestedEnumWebhookOwnerTypeFilterObjectSchema)]).optional()
}).strict();
export const EnumWebhookOwnerTypeFilterObjectSchema: z.ZodType<Prisma.EnumWebhookOwnerTypeFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookOwnerTypeFilter>;
export const EnumWebhookOwnerTypeFilterObjectZodSchema = makeSchema();
