import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema'

const nestedenumwebhookeventstatusfilterSchema = z.object({
  equals: WebhookEventStatusSchema.optional(),
  in: WebhookEventStatusSchema.array().optional(),
  notIn: WebhookEventStatusSchema.array().optional(),
  not: z.union([WebhookEventStatusSchema, z.lazy(() => NestedEnumWebhookEventStatusFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumWebhookEventStatusFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookEventStatusFilter> = nestedenumwebhookeventstatusfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookEventStatusFilter>;
export const NestedEnumWebhookEventStatusFilterObjectZodSchema = nestedenumwebhookeventstatusfilterSchema;
