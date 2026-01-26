import * as z from 'zod';
import { InquiryTypeSchema } from '../../enums/InquiryType.schema';
import { InquiryStatusSchema } from '../../enums/InquiryStatus.schema';
import { InquiryResourceModelSchema } from '../../enums/InquiryResourceModel.schema';
// prettier-ignore
export const InquiryModelSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    sentAt: z.date().nullable(),
    type: InquiryTypeSchema,
    status: InquiryStatusSchema,
    content: z.unknown(),
    resolution: z.unknown(),
    sourceModel: InquiryResourceModelSchema,
    sourceUserId: z.string().nullable(),
    sourceOrganizationId: z.string().nullable(),
    sourceUser: z.unknown().nullable(),
    sourceOrganization: z.unknown().nullable(),
    targetModel: InquiryResourceModelSchema.nullable(),
    targetUserId: z.string().nullable(),
    targetOrganizationId: z.string().nullable(),
    targetUser: z.unknown().nullable(),
    targetOrganization: z.unknown().nullable()
}).strict();

export type InquiryPureType = z.infer<typeof InquiryModelSchema>;
