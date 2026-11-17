import { inquiryCancellation } from '#/modules/inquiry/services/inquiryCancellation';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

// Children a parent's tombstone reaches only while they are open, and closes as it buries them; a
// closed one stays, live, as the record of what was decided.
export const TOMBSTONE_CLOSES: Record<
  string,
  { open: Record<string, unknown>; closed: Record<string, unknown> }
> = {
  // An open inquiry whose party is gone can no longer be answered: it is canceled (Aron, 2026-11-16).
  Inquiry: { open: { status: { notIn: inquiryTerminalStatuses } }, closed: inquiryCancellation },
};
