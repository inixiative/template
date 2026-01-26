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
import { EnumInquiryResourceModelNullableFilterObjectSchema as EnumInquiryResourceModelNullableFilterObjectSchema } from './EnumInquiryResourceModelNullableFilter.schema';
import { UserNullableScalarRelationFilterObjectSchema as UserNullableScalarRelationFilterObjectSchema } from './UserNullableScalarRelationFilter.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { OrganizationNullableScalarRelationFilterObjectSchema as OrganizationNullableScalarRelationFilterObjectSchema } from './OrganizationNullableScalarRelationFilter.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const inquirywhereinputSchema = z.object({
  AND: z.union([z.lazy(() => InquiryWhereInputObjectSchema), z.lazy(() => InquiryWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => InquiryWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => InquiryWhereInputObjectSchema), z.lazy(() => InquiryWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  sentAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  type: z.union([z.lazy(() => EnumInquiryTypeFilterObjectSchema), InquiryTypeSchema]).optional(),
  status: z.union([z.lazy(() => EnumInquiryStatusFilterObjectSchema), InquiryStatusSchema]).optional(),
  content: z.lazy(() => JsonFilterObjectSchema).optional(),
  resolution: z.lazy(() => JsonFilterObjectSchema).optional(),
  sourceModel: z.union([z.lazy(() => EnumInquiryResourceModelFilterObjectSchema), InquiryResourceModelSchema]).optional(),
  sourceUserId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  sourceOrganizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  targetModel: z.union([z.lazy(() => EnumInquiryResourceModelNullableFilterObjectSchema), InquiryResourceModelSchema]).optional().nullable(),
  targetUserId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  targetOrganizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  sourceUser: z.union([z.lazy(() => UserNullableScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  sourceOrganization: z.union([z.lazy(() => OrganizationNullableScalarRelationFilterObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  targetUser: z.union([z.lazy(() => UserNullableScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  targetOrganization: z.union([z.lazy(() => OrganizationNullableScalarRelationFilterObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional()
}).strict();
export const InquiryWhereInputObjectSchema: z.ZodType<Prisma.InquiryWhereInput> = inquirywhereinputSchema as unknown as z.ZodType<Prisma.InquiryWhereInput>;
export const InquiryWhereInputObjectZodSchema = inquirywhereinputSchema;
