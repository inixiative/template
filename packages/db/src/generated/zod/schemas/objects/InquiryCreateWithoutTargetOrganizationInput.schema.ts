import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { JsonNullValueInputSchema } from '../enums/JsonNullValueInput.schema';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { UserCreateNestedOneWithoutInquiriesSentInputObjectSchema as UserCreateNestedOneWithoutInquiriesSentInputObjectSchema } from './UserCreateNestedOneWithoutInquiriesSentInput.schema';
import { OrganizationCreateNestedOneWithoutInquiriesSentInputObjectSchema as OrganizationCreateNestedOneWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateNestedOneWithoutInquiriesSentInput.schema';
import { UserCreateNestedOneWithoutInquiriesReceivedInputObjectSchema as UserCreateNestedOneWithoutInquiriesReceivedInputObjectSchema } from './UserCreateNestedOneWithoutInquiriesReceivedInput.schema'

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
  targetUser: z.lazy(() => UserCreateNestedOneWithoutInquiriesReceivedInputObjectSchema).optional()
}).strict();
export const InquiryCreateWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryCreateWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateWithoutTargetOrganizationInput>;
export const InquiryCreateWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
