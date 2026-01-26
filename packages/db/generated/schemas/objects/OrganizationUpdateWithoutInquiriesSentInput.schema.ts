import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema as OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema } from './OrganizationUserUpdateManyWithoutOrganizationNestedInput.schema';
import { TokenUpdateManyWithoutOrganizationNestedInputObjectSchema as TokenUpdateManyWithoutOrganizationNestedInputObjectSchema } from './TokenUpdateManyWithoutOrganizationNestedInput.schema';
import { WebhookSubscriptionUpdateManyWithoutOrganizationNestedInputObjectSchema as WebhookSubscriptionUpdateManyWithoutOrganizationNestedInputObjectSchema } from './WebhookSubscriptionUpdateManyWithoutOrganizationNestedInput.schema';
import { InquiryUpdateManyWithoutTargetOrganizationNestedInputObjectSchema as InquiryUpdateManyWithoutTargetOrganizationNestedInputObjectSchema } from './InquiryUpdateManyWithoutTargetOrganizationNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  deletedAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  name: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  slug: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  users: z.lazy(() => OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUpdateManyWithoutTargetOrganizationNestedInputObjectSchema).optional()
}).strict();
export const OrganizationUpdateWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateWithoutInquiriesSentInput>;
export const OrganizationUpdateWithoutInquiriesSentInputObjectZodSchema = makeSchema();
