import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { NestedEnumWebhookModelFilterObjectSchema as NestedEnumWebhookModelFilterObjectSchema } from './NestedEnumWebhookModelFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookModelSchema.optional(),
  in: WebhookModelSchema.array().optional(),
  notIn: WebhookModelSchema.array().optional(),
  not: z.union([WebhookModelSchema, z.lazy(() => NestedEnumWebhookModelFilterObjectSchema)]).optional()
}).strict();
export const EnumWebhookModelFilterObjectSchema: z.ZodType<Prisma.EnumWebhookModelFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookModelFilter>;
export const EnumWebhookModelFilterObjectZodSchema = makeSchema();
