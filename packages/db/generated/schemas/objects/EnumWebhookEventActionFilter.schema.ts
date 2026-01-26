import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { NestedEnumWebhookEventActionFilterObjectSchema as NestedEnumWebhookEventActionFilterObjectSchema } from './NestedEnumWebhookEventActionFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookEventActionSchema.optional(),
  in: WebhookEventActionSchema.array().optional(),
  notIn: WebhookEventActionSchema.array().optional(),
  not: z.union([WebhookEventActionSchema, z.lazy(() => NestedEnumWebhookEventActionFilterObjectSchema)]).optional()
}).strict();
export const EnumWebhookEventActionFilterObjectSchema: z.ZodType<Prisma.EnumWebhookEventActionFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookEventActionFilter>;
export const EnumWebhookEventActionFilterObjectZodSchema = makeSchema();
