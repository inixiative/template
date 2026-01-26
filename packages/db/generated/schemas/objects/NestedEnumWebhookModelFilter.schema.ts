import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema'

const nestedenumwebhookmodelfilterSchema = z.object({
  equals: WebhookModelSchema.optional(),
  in: WebhookModelSchema.array().optional(),
  notIn: WebhookModelSchema.array().optional(),
  not: z.union([WebhookModelSchema, z.lazy(() => NestedEnumWebhookModelFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumWebhookModelFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookModelFilter> = nestedenumwebhookmodelfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookModelFilter>;
export const NestedEnumWebhookModelFilterObjectZodSchema = nestedenumwebhookmodelfilterSchema;
