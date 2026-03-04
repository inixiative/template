import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const assertInquiryIsDraft = (inquiry: Inquiry, requestId: string): void => {
  if (inquiry.status !== InquiryStatus.draft)
    throw makeError({ status: 400, message: 'Inquiry must be a draft', requestId });
};

// draft | sent | changesRequested — can still be acted on by the source
export const assertInquiryIsEditable = (inquiry: Inquiry, requestId: string): void => {
  const editable = [InquiryStatus.draft, InquiryStatus.sent, InquiryStatus.changesRequested];
  if (!editable.includes(inquiry.status as InquiryStatus))
    throw makeError({ status: 400, message: 'Inquiry cannot be updated in its current state', requestId });
};

// sent | changesRequested — can be resolved or have changes requested
export const assertInquiryIsResolvable = (inquiry: Inquiry, requestId: string): void => {
  const resolvable = [InquiryStatus.sent, InquiryStatus.changesRequested];
  if (!resolvable.includes(inquiry.status as InquiryStatus))
    throw makeError({ status: 400, message: 'Inquiry must be sent or changes requested', requestId });
};

// not yet resolved or canceled
export const assertInquiryIsCancelable = (inquiry: Inquiry, requestId: string): void => {
  const terminal = [InquiryStatus.approved, InquiryStatus.denied, InquiryStatus.canceled];
  if (terminal.includes(inquiry.status as InquiryStatus))
    throw makeError({ status: 400, message: 'Cannot cancel a resolved or already canceled inquiry', requestId });
};
