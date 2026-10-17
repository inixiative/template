/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { InquiryStatus } from '@template/db/generated/client/enums';

export const inquiryResolutionStatusSchema = z.enum([
  InquiryStatus.approved,
  InquiryStatus.denied,
  InquiryStatus.changesRequested,
]);

export type InquiryResolutionStatus = z.infer<typeof inquiryResolutionStatusSchema>;
