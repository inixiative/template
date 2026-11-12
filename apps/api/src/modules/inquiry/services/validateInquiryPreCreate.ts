/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses none
 */
import type { InquiryType } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import type { InquirySourceFields } from '#/modules/inquiry/services/resolveInquirySource';
import type { InquiryTargetFields } from '#/modules/inquiry/services/resolveInquiryTarget';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';

export const validateInquiryPreCreate = async (
  handler: InquiryHandler,
  type: InquiryType,
  source: InquirySourceFields,
  target: InquiryTargetFields,
  content: Record<string, unknown>,
): Promise<void> => {
  if (handler.validate) await handler.validate({ ...source, ...target }, content);
  if (handler.unique) await validateUniqueInquiry({ type, ...source, ...target }, handler.unique);
};
