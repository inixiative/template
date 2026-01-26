import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { DateTimeNullableWithAggregatesFilterObjectSchema as DateTimeNullableWithAggregatesFilterObjectSchema } from './DateTimeNullableWithAggregatesFilter.schema';
import { EnumInquiryTypeWithAggregatesFilterObjectSchema as EnumInquiryTypeWithAggregatesFilterObjectSchema } from './EnumInquiryTypeWithAggregatesFilter.schema';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { EnumInquiryStatusWithAggregatesFilterObjectSchema as EnumInquiryStatusWithAggregatesFilterObjectSchema } from './EnumInquiryStatusWithAggregatesFilter.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { JsonWithAggregatesFilterObjectSchema as JsonWithAggregatesFilterObjectSchema } from './JsonWithAggregatesFilter.schema';
import { EnumInquiryResourceModelWithAggregatesFilterObjectSchema as EnumInquiryResourceModelWithAggregatesFilterObjectSchema } from './EnumInquiryResourceModelWithAggregatesFilter.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { StringNullableWithAggregatesFilterObjectSchema as StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema';
import { EnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema as EnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema } from './EnumInquiryResourceModelNullableWithAggregatesFilter.schema'

const inquiryscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => InquiryScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => InquiryScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => InquiryScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => InquiryScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => InquiryScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  sentAt: z.union([z.lazy(() => DateTimeNullableWithAggregatesFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  type: z.union([z.lazy(() => EnumInquiryTypeWithAggregatesFilterObjectSchema), InquiryTypeSchema]).optional(),
  status: z.union([z.lazy(() => EnumInquiryStatusWithAggregatesFilterObjectSchema), InquiryStatusSchema]).optional(),
  content: z.lazy(() => JsonWithAggregatesFilterObjectSchema).optional(),
  resolution: z.lazy(() => JsonWithAggregatesFilterObjectSchema).optional(),
  sourceModel: z.union([z.lazy(() => EnumInquiryResourceModelWithAggregatesFilterObjectSchema), InquiryResourceModelSchema]).optional(),
  sourceUserId: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  sourceOrganizationId: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  targetModel: z.union([z.lazy(() => EnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema), InquiryResourceModelSchema]).optional().nullable(),
  targetUserId: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  targetOrganizationId: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable()
}).strict();
export const InquiryScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.InquiryScalarWhereWithAggregatesInput> = inquiryscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.InquiryScalarWhereWithAggregatesInput>;
export const InquiryScalarWhereWithAggregatesInputObjectZodSchema = inquiryscalarwherewithaggregatesinputSchema;
