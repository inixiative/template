import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema'

const nestedenumwebhookownermodelfilterSchema = z.object({
  equals: WebhookOwnerModelSchema.optional(),
  in: WebhookOwnerModelSchema.array().optional(),
  notIn: WebhookOwnerModelSchema.array().optional(),
  not: z.union([WebhookOwnerModelSchema, z.lazy(() => NestedEnumWebhookOwnerModelFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumWebhookOwnerModelFilterObjectSchema: z.ZodType<Prisma.NestedEnumWebhookOwnerModelFilter> = nestedenumwebhookownermodelfilterSchema as unknown as z.ZodType<Prisma.NestedEnumWebhookOwnerModelFilter>;
export const NestedEnumWebhookOwnerModelFilterObjectZodSchema = nestedenumwebhookownermodelfilterSchema;
