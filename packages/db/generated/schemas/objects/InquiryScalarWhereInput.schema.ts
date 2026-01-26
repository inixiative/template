import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { EnumInquiryTypeFilterObjectSchema as EnumInquiryTypeFilterObjectSchema } from './EnumInquiryTypeFilter.schema';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { EnumInquiryStatusFilterObjectSchema as EnumInquiryStatusFilterObjectSchema } from './EnumInquiryStatusFilter.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { JsonFilterObjectSchema as JsonFilterObjectSchema } from './JsonFilter.schema';
import { EnumInquiryResourceModelFilterObjectSchema as EnumInquiryResourceModelFilterObjectSchema } from './EnumInquiryResourceModelFilter.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { EnumInquiryResourceModelNullableFilterObjectSchema as EnumInquiryResourceModelNullableFilterObjectSchema } from './EnumInquiryResourceModelNullableFilter.schema'

const inquiryscalarwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => InquiryScalarWhereInputObjectSchema), z.lazy(() => InquiryScalarWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => InquiryScalarWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => InquiryScalarWhereInputObjectSchema), z.lazy(() => InquiryScalarWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  sentAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  type: z.union([z.lazy(() => EnumInquiryTypeFilterObjectSchema), InquiryTypeSchema]).optional(),
  status: z.union([z.lazy(() => EnumInquiryStatusFilterObjectSchema), InquiryStatusSchema]).optional(),
  content: z.lazy(() => JsonFilterObjectSchema).optional(),
  resolution: z.lazy(() => JsonFilterObjectSchema).optional(),
  sourceModel: z.union([z.lazy(() => EnumInquiryResourceModelFilterObjectSchema), InquiryResourceModelSchema]).optional(),
  sourceUserId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  sourceOrganizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  targetModel: z.union([z.lazy(() => EnumInquiryResourceModelNullableFilterObjectSchema), InquiryResourceModelSchema]).optional().nullable(),
  targetUserId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  targetOrganizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable()
}).strict();
export const InquiryScalarWhereInputObjectSchema: z.ZodType<Prisma.InquiryScalarWhereInput> = inquiryscalarwhereinputSchema as unknown as z.ZodType<Prisma.InquiryScalarWhereInput>;
export const InquiryScalarWhereInputObjectZodSchema = inquiryscalarwhereinputSchema;
