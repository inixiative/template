import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { WebhookEventUncheckedCreateNestedManyWithoutSubscriptionInputObjectSchema as WebhookEventUncheckedCreateNestedManyWithoutSubscriptionInputObjectSchema } from './WebhookEventUncheckedCreateNestedManyWithoutSubscriptionInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string().max(512),
  secret: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
  ownerType: WebhookOwnerTypeSchema,
  ownerId: z.string().max(36),
  events: z.lazy(() => WebhookEventUncheckedCreateNestedManyWithoutSubscriptionInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUncheckedCreateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateInput>;
export const WebhookSubscriptionUncheckedCreateInputObjectZodSchema = makeSchema();
