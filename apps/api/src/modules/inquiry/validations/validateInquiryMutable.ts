import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';

export const TERMINAL_STATUSES = [InquiryStatus.approved, InquiryStatus.denied, InquiryStatus.canceled];

export const validateInquiryMutable = (inquiry: { status: InquiryStatus }, requestId?: string): void => {
  if (TERMINAL_STATUSES.includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Inquiry is already resolved or canceled', requestId });
  }
};
