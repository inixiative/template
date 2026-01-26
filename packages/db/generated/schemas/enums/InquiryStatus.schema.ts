import * as z from 'zod';

export const InquiryStatusSchema = z.enum(['draft', 'sent', 'acknowledged', 'resolved', 'canceled'])

export type InquiryStatus = z.infer<typeof InquiryStatusSchema>;