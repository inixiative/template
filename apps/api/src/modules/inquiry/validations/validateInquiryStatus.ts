import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const inquiryTerminalStatuses: InquiryStatus[] = [
  InquiryStatus.approved,
  InquiryStatus.denied,
  InquiryStatus.canceled,
];

export const validateInquiryIsDraft = (inquiry: Inquiry): void => {
  if (inquiry.status !== InquiryStatus.draft) throw makeError({ status: 400, message: 'Inquiry must be a draft' });
};

// draft | sent | changesRequested — can still be acted on by the source
export const validateInquiryIsEditable = (inquiry: Inquiry): void => {
  const editable: InquiryStatus[] = [InquiryStatus.draft, InquiryStatus.sent, InquiryStatus.changesRequested];
  if (!editable.includes(inquiry.status as InquiryStatus))
    throw makeError({ status: 400, message: 'Inquiry cannot be updated in its current state' });
};

// sent | changesRequested — can be resolved or have changes requested
export const validateInquiryIsResolvable = (inquiry: Inquiry): void => {
  const resolvable: InquiryStatus[] = [InquiryStatus.sent, InquiryStatus.changesRequested];
  if (!resolvable.includes(inquiry.status as InquiryStatus))
    throw makeError({ status: 400, message: 'Inquiry must be sent or changes requested' });
};

// expiresAt is in the past
export const validateInquiryNotExpired = (inquiry: Inquiry): void => {
  if (inquiry.expiresAt && inquiry.expiresAt < new Date())
    throw makeError({ status: 410, message: 'Inquiry has expired' });
};

// not yet resolved or canceled
export const validateInquiryIsCancelable = (inquiry: Inquiry): void => {
  const terminal: InquiryStatus[] = [InquiryStatus.approved, InquiryStatus.denied, InquiryStatus.canceled];
  if (terminal.includes(inquiry.status as InquiryStatus))
    throw makeError({ status: 400, message: 'Cannot cancel a resolved or already canceled inquiry' });
};
