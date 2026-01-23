import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { NestedEnumWebhookEventStatusFilterObjectSchema as NestedEnumWebhookEventStatusFilterObjectSchema } from './NestedEnumWebhookEventStatusFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookEventStatusSchema.optional(),
  in: WebhookEventStatusSchema.array().optional(),
  notIn: WebhookEventStatusSchema.array().optional(),
  not: z.union([WebhookEventStatusSchema, z.lazy(() => NestedEnumWebhookEventStatusFilterObjectSchema)]).optional()
}).strict();
export const EnumWebhookEventStatusFilterObjectSchema: z.ZodType<Prisma.EnumWebhookEventStatusFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookEventStatusFilter>;
export const EnumWebhookEventStatusFilterObjectZodSchema = makeSchema();
