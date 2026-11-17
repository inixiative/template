/**
 * @atlas
 * @kind constant
 * @partOf feature:inquiry
 * @uses none
 */
import { InquiryStatus } from '@template/db/generated/client/enums';

/** What canceling writes: no longer open, never expires. */
export const inquiryCancellation = { status: InquiryStatus.canceled, expiresAt: null } as const;
