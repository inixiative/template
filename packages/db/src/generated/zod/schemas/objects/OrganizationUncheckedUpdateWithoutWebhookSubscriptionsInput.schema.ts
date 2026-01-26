import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { OrganizationUserUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema as OrganizationUserUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema } from './OrganizationUserUncheckedUpdateManyWithoutOrganizationNestedInput.schema';
import { TokenUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema as TokenUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema } from './TokenUncheckedUpdateManyWithoutOrganizationNestedInput.schema';
import { InquiryUncheckedUpdateManyWithoutSourceOrganizationNestedInputObjectSchema as InquiryUncheckedUpdateManyWithoutSourceOrganizationNestedInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutSourceOrganizationNestedInput.schema';
import { InquiryUncheckedUpdateManyWithoutTargetOrganizationNestedInputObjectSchema as InquiryUncheckedUpdateManyWithoutTargetOrganizationNestedInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutTargetOrganizationNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  deletedAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  name: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  slug: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  organizationUsers: z.lazy(() => OrganizationUserUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUncheckedUpdateManyWithoutOrganizationNestedInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUncheckedUpdateManyWithoutSourceOrganizationNestedInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedUpdateManyWithoutTargetOrganizationNestedInputObjectSchema).optional()
}).strict();
export const OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInput>;
export const OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
