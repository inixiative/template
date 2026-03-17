import type { InquiryType } from '@template/db/generated/client/enums';
import { inquiryHandlers } from '#/modules/inquiry/handlers';

export const computeExpiresAt = (type: InquiryType, from: Date = new Date()): Date | null => {
  const handler = inquiryHandlers[type];
  if (!handler.defaultExpirationDays) return null;

  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + handler.defaultExpirationDays);
  return expiresAt;
};
