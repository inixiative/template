import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { JsonNullValueInputSchema } from '../enums/JsonNullValueInput.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { UserCreateNestedOneWithoutInquiriesSentInputObjectSchema as UserCreateNestedOneWithoutInquiriesSentInputObjectSchema } from './UserCreateNestedOneWithoutInquiriesSentInput.schema';
import { OrganizationCreateNestedOneWithoutInquiriesSentInputObjectSchema as OrganizationCreateNestedOneWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateNestedOneWithoutInquiriesSentInput.schema';
import { OrganizationCreateNestedOneWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateNestedOneWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateNestedOneWithoutInquiriesReceivedInput.schema'

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
  targetModel: InquiryResourceModelSchema.optional().nullable(),
  sourceUser: z.lazy(() => UserCreateNestedOneWithoutInquiriesSentInputObjectSchema).optional(),
  sourceOrganization: z.lazy(() => OrganizationCreateNestedOneWithoutInquiriesSentInputObjectSchema).optional(),
  targetOrganization: z.lazy(() => OrganizationCreateNestedOneWithoutInquiriesReceivedInputObjectSchema).optional()
}).strict();
export const InquiryCreateWithoutTargetUserInputObjectSchema: z.ZodType<Prisma.InquiryCreateWithoutTargetUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateWithoutTargetUserInput>;
export const InquiryCreateWithoutTargetUserInputObjectZodSchema = makeSchema();
