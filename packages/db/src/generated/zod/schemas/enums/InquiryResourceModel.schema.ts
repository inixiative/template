import * as z from 'zod';

export const InquiryResourceModelSchema = z.enum(['User', 'Organization'])

export type InquiryResourceModel = z.infer<typeof InquiryResourceModelSchema>;