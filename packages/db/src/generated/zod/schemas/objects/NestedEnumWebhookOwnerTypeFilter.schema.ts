import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema'

const nestedenumwebhookownertypefilterSchema = z.object({
  equals: WebhookOwnerTypeSchema.optional(),
  in: WebhookOwnerTypeSchema.array().optional(),
  notIn: WebhookOwnerTypeSchema.array().optional(),
  not: z.union([WebhookOwnerTypeSchema, z.lazy(() => NestedEnumWebhookOwnerTypeFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumWebhookOwnerTypeFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookOwnerTypeFilter> = nestedenumwebhookownertypefilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookOwnerTypeFilter>;
export const NestedEnumWebhookOwnerTypeFilterObjectZodSchema = nestedenumwebhookownertypefilterSchema;
