import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { WebhookEventCreateNestedManyWithoutSubscriptionInputObjectSchema as WebhookEventCreateNestedManyWithoutSubscriptionInputObjectSchema } from './WebhookEventCreateNestedManyWithoutSubscriptionInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string().max(512),
  secret: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
  ownerType: WebhookOwnerTypeSchema,
  ownerId: z.string().max(36),
  events: z.lazy(() => WebhookEventCreateNestedManyWithoutSubscriptionInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionCreateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateInput>;
export const WebhookSubscriptionCreateInputObjectZodSchema = makeSchema();
