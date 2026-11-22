/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses none
 */
import type { InquiryType } from '@template/db/generated/client/enums';
import { inquiryServices } from '#/modules/inquiry/services';

export const computeExpiresAt = (type: InquiryType, from: Date = new Date()): Date | null => {
  const service = inquiryServices[type];
  if (!service.defaultExpirationDays) return null;

  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + service.defaultExpirationDays);
  return expiresAt;
};
