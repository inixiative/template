import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { NestedEnumWebhookOwnerModelFilterObjectSchema as NestedEnumWebhookOwnerModelFilterObjectSchema } from './NestedEnumWebhookOwnerModelFilter.schema'

const makeSchema = () => z.object({
  equals: WebhookOwnerModelSchema.optional(),
  in: WebhookOwnerModelSchema.array().optional(),
  notIn: WebhookOwnerModelSchema.array().optional(),
  not: z.union([WebhookOwnerModelSchema, z.lazy(() => NestedEnumWebhookOwnerModelFilterObjectSchema)]).optional()
}).strict();
export const EnumWebhookOwnerModelFilterObjectSchema: z.ZodType<Prisma.EnumWebhookOwnerModelFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookOwnerModelFilter>;
export const EnumWebhookOwnerModelFilterObjectZodSchema = makeSchema();
