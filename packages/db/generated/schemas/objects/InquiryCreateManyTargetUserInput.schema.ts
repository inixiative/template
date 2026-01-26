import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { JsonNullValueInputSchema } from '../enums/JsonNullValueInput.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional().nullable(),
  type: InquiryTypeSchema,
  status: InquiryStatusSchema.optional(),
  content: z.union([JsonNullValueInputSchema, jsonSchema]).optional(),
  resolution: z.union([JsonNullValueInputSchema, jsonSchema]).optional(),
  sourceModel: InquiryResourceModelSchema,
  sourceUserId: z.string().max(36).optional().nullable(),
  sourceOrganizationId: z.string().max(36).optional().nullable(),
  targetModel: InquiryResourceModelSchema.optional().nullable(),
  targetOrganizationId: z.string().max(36).optional().nullable()
}).strict();
export const InquiryCreateManyTargetUserInputObjectSchema: z.ZodType<Prisma.InquiryCreateManyTargetUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateManyTargetUserInput>;
export const InquiryCreateManyTargetUserInputObjectZodSchema = makeSchema();
