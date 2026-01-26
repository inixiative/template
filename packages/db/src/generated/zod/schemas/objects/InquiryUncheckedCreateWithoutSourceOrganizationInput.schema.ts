import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { JsonNullValueInputSchema } from '../enums/JsonNullValueInput.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional().nullable(),
  type: InquiryTypeSchema,
  status: InquiryStatusSchema.optional(),
  content: z.union([JsonNullValueInputSchema, jsonSchema]).optional(),
  resolution: z.union([JsonNullValueInputSchema, jsonSchema]).optional(),
  sourceModel: InquiryResourceModelSchema,
  sourceUserId: z.string().optional().nullable(),
  targetModel: InquiryResourceModelSchema.optional().nullable(),
  targetUserId: z.string().optional().nullable(),
  targetOrganizationId: z.string().optional().nullable()
}).strict();
export const InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUncheckedCreateWithoutSourceOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUncheckedCreateWithoutSourceOrganizationInput>;
export const InquiryUncheckedCreateWithoutSourceOrganizationInputObjectZodSchema = makeSchema();
