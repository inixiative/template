import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { EnumInquiryTypeFieldUpdateOperationsInputObjectSchema as EnumInquiryTypeFieldUpdateOperationsInputObjectSchema } from './EnumInquiryTypeFieldUpdateOperationsInput.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { EnumInquiryStatusFieldUpdateOperationsInputObjectSchema as EnumInquiryStatusFieldUpdateOperationsInputObjectSchema } from './EnumInquiryStatusFieldUpdateOperationsInput.schema';
import { JsonNullValueInputSchema } from '../enums/JsonNullValueInput.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { EnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema as EnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema } from './EnumInquiryResourceModelFieldUpdateOperationsInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { NullableEnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema as NullableEnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema } from './NullableEnumInquiryResourceModelFieldUpdateOperationsInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  sentAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  type: z.union([InquiryTypeSchema, z.lazy(() => EnumInquiryTypeFieldUpdateOperationsInputObjectSchema)]).optional(),
  status: z.union([InquiryStatusSchema, z.lazy(() => EnumInquiryStatusFieldUpdateOperationsInputObjectSchema)]).optional(),
  content: z.union([JsonNullValueInputSchema, jsonSchema]).optional(),
  resolution: z.union([JsonNullValueInputSchema, jsonSchema]).optional(),
  sourceModel: z.union([InquiryResourceModelSchema, z.lazy(() => EnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  sourceUserId: z.union([z.string().max(36), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  sourceOrganizationId: z.union([z.string().max(36), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  targetModel: z.union([InquiryResourceModelSchema, z.lazy(() => NullableEnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  targetUserId: z.union([z.string().max(36), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable()
}).strict();
export const InquiryUncheckedUpdateManyWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUncheckedUpdateManyWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUncheckedUpdateManyWithoutTargetOrganizationInput>;
export const InquiryUncheckedUpdateManyWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
