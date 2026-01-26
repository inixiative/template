import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema'

const nestedenumwebhookeventactionfilterSchema = z.object({
  equals: WebhookEventActionSchema.optional(),
  in: WebhookEventActionSchema.array().optional(),
  notIn: WebhookEventActionSchema.array().optional(),
  not: z.union([WebhookEventActionSchema, z.lazy(() => NestedEnumWebhookEventActionFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumWebhookEventActionFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookEventActionFilter> = nestedenumwebhookeventactionfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookEventActionFilter>;
export const NestedEnumWebhookEventActionFilterObjectZodSchema = nestedenumwebhookeventactionfilterSchema;
