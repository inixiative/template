import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { EnumWebhookModelFieldUpdateOperationsInputObjectSchema as EnumWebhookModelFieldUpdateOperationsInputObjectSchema } from './EnumWebhookModelFieldUpdateOperationsInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { BoolFieldUpdateOperationsInputObjectSchema as BoolFieldUpdateOperationsInputObjectSchema } from './BoolFieldUpdateOperationsInput.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema';
import { EnumWebhookOwnerTypeFieldUpdateOperationsInputObjectSchema as EnumWebhookOwnerTypeFieldUpdateOperationsInputObjectSchema } from './EnumWebhookOwnerTypeFieldUpdateOperationsInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  model: z.union([WebhookModelSchema, z.lazy(() => EnumWebhookModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  url: z.union([z.string().max(512), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  secret: z.union([z.string().max(255), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  isActive: z.union([z.boolean(), z.lazy(() => BoolFieldUpdateOperationsInputObjectSchema)]).optional(),
  ownerType: z.union([WebhookOwnerTypeSchema, z.lazy(() => EnumWebhookOwnerTypeFieldUpdateOperationsInputObjectSchema)]).optional(),
  ownerId: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional()
}).strict();
export const WebhookSubscriptionUncheckedUpdateManyInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedUpdateManyInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedUpdateManyInput>;
export const WebhookSubscriptionUncheckedUpdateManyInputObjectZodSchema = makeSchema();
