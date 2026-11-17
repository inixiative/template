/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { inquiryCancellation } from '#/modules/inquiry/services/inquiryCancellation';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

// Children a parent's delete closes instead of burying, keyed by the child: the open ones get
// `closed` written, nothing is tombstoned, and every row stays live as the record of what happened.
// Every parent of a model listed here must be soft-delete only (validateDeleteBehavior), so a hard
// delete can never take the record with it.
export const CLOSE_ON_PARENT_DELETE: Record<
  string,
  { open: Record<string, unknown>; closed: Record<string, unknown> }
> = {
  // An open inquiry whose party is gone can no longer be answered: it is canceled (Aron, 2026-11-16).
  Inquiry: { open: { status: { notIn: inquiryTerminalStatuses } }, closed: inquiryCancellation },
};

export const isClosedOnParentDelete = (model: string): boolean => model in CLOSE_ON_PARENT_DELETE;
