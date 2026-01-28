import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { EnumWebhookModelFieldUpdateOperationsInputObjectSchema as EnumWebhookModelFieldUpdateOperationsInputObjectSchema } from './EnumWebhookModelFieldUpdateOperationsInput.schema';
import { BoolFieldUpdateOperationsInputObjectSchema as BoolFieldUpdateOperationsInputObjectSchema } from './BoolFieldUpdateOperationsInput.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema as EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema } from './EnumWebhookOwnerModelFieldUpdateOperationsInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema as WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema } from './WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  model: z.union([WebhookModelSchema, z.lazy(() => EnumWebhookModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  url: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  isActive: z.union([z.boolean(), z.lazy(() => BoolFieldUpdateOperationsInputObjectSchema)]).optional(),
  ownerModel: z.union([WebhookOwnerModelSchema, z.lazy(() => EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  userId: z.union([z.string().max(36), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  organizationId: z.union([z.string().max(36), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  webhookEvents: z.lazy(() => WebhookEventUncheckedUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUncheckedUpdateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedUpdateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedUpdateInput>;
export const WebhookSubscriptionUncheckedUpdateInputObjectZodSchema = makeSchema();
