import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema as OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema } from './OrganizationUserUpdateManyWithoutOrganizationNestedInput.schema';
import { TokenUpdateManyWithoutOrganizationNestedInputObjectSchema as TokenUpdateManyWithoutOrganizationNestedInputObjectSchema } from './TokenUpdateManyWithoutOrganizationNestedInput.schema';
import { WebhookSubscriptionUpdateManyWithoutOrganizationNestedInputObjectSchema as WebhookSubscriptionUpdateManyWithoutOrganizationNestedInputObjectSchema } from './WebhookSubscriptionUpdateManyWithoutOrganizationNestedInput.schema';
import { InquiryUpdateManyWithoutSourceOrganizationNestedInputObjectSchema as InquiryUpdateManyWithoutSourceOrganizationNestedInputObjectSchema } from './InquiryUpdateManyWithoutSourceOrganizationNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  deletedAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  name: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  slug: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  organizationUsers: z.lazy(() => OrganizationUserUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUpdateManyWithoutSourceOrganizationNestedInputObjectSchema).optional()
}).strict();
export const OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateWithoutInquiriesReceivedInput>;
export const OrganizationUpdateWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
