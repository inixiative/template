import * as z from 'zod';
import { InquiryTypeSchema } from '../../enums/InquiryType.schema';
import { InquiryStatusSchema } from '../../enums/InquiryStatus.schema';
import { InquiryResourceModelSchema } from '../../enums/InquiryResourceModel.schema';
// prettier-ignore
export const InquiryInputSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    sentAt: z.date().optional().nullable(),
    type: InquiryTypeSchema,
    status: InquiryStatusSchema,
    content: z.unknown(),
    resolution: z.unknown(),
    sourceModel: InquiryResourceModelSchema,
    sourceUserId: z.string().optional().nullable(),
    sourceOrganizationId: z.string().optional().nullable(),
    sourceUser: z.unknown().optional().nullable(),
    sourceOrganization: z.unknown().optional().nullable(),
    targetModel: InquiryResourceModelSchema.optional().nullable(),
    targetUserId: z.string().optional().nullable(),
    targetOrganizationId: z.string().optional().nullable(),
    targetUser: z.unknown().optional().nullable(),
    targetOrganization: z.unknown().optional().nullable()
}).strict();

export type InquiryInputType = z.infer<typeof InquiryInputSchema>;
