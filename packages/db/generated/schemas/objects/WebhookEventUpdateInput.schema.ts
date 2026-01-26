import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { EnumWebhookEventStatusFieldUpdateOperationsInputObjectSchema as EnumWebhookEventStatusFieldUpdateOperationsInputObjectSchema } from './EnumWebhookEventStatusFieldUpdateOperationsInput.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { EnumWebhookEventActionFieldUpdateOperationsInputObjectSchema as EnumWebhookEventActionFieldUpdateOperationsInputObjectSchema } from './EnumWebhookEventActionFieldUpdateOperationsInput.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInputObjectSchema as WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInputObjectSchema } from './WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  status: z.union([WebhookEventStatusSchema, z.lazy(() => EnumWebhookEventStatusFieldUpdateOperationsInputObjectSchema)]).optional(),
  action: z.union([WebhookEventActionSchema, z.lazy(() => EnumWebhookEventActionFieldUpdateOperationsInputObjectSchema)]).optional(),
  payload: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  error: z.union([z.string(), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  resourceId: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  webhookSubscription: z.lazy(() => WebhookSubscriptionUpdateOneRequiredWithoutEventsNestedInputObjectSchema).optional()
}).strict();
export const WebhookEventUpdateInputObjectSchema: z.ZodType<Prisma.WebhookEventUpdateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUpdateInput>;
export const WebhookEventUpdateInputObjectZodSchema = makeSchema();
