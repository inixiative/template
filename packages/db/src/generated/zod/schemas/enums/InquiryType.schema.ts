import * as z from 'zod';

export const InquiryTypeSchema = z.enum(['memberInvitation', 'memberApplication'])

export type InquiryType = z.infer<typeof InquiryTypeSchema>;