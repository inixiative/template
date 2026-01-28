import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { EnumWebhookModelFieldUpdateOperationsInputObjectSchema as EnumWebhookModelFieldUpdateOperationsInputObjectSchema } from './EnumWebhookModelFieldUpdateOperationsInput.schema';
import { BoolFieldUpdateOperationsInputObjectSchema as BoolFieldUpdateOperationsInputObjectSchema } from './BoolFieldUpdateOperationsInput.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';
import { EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema as EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema } from './EnumWebhookOwnerModelFieldUpdateOperationsInput.schema';
import { OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInputObjectSchema as OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInputObjectSchema } from './OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInput.schema';
import { WebhookEventUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema as WebhookEventUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema } from './WebhookEventUpdateManyWithoutWebhookSubscriptionNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  model: z.union([WebhookModelSchema, z.lazy(() => EnumWebhookModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  url: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  isActive: z.union([z.boolean(), z.lazy(() => BoolFieldUpdateOperationsInputObjectSchema)]).optional(),
  ownerModel: z.union([WebhookOwnerModelSchema, z.lazy(() => EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  organization: z.lazy(() => OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInputObjectSchema).optional(),
  webhookEvents: z.lazy(() => WebhookEventUpdateManyWithoutWebhookSubscriptionNestedInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionUpdateWithoutUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateWithoutUserInput>;
export const WebhookSubscriptionUpdateWithoutUserInputObjectZodSchema = makeSchema();
