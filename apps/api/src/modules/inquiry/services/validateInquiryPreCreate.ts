/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses none
 */
import type { InquiryType } from '@template/db/generated/client/enums';
import type { InquirySourceFields } from '#/modules/inquiry/services/resolveInquirySource';
import type { InquiryTargetFields } from '#/modules/inquiry/services/resolveInquiryTarget';
import type { InquiryService } from '#/modules/inquiry/services/types';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';

export const validateInquiryPreCreate = async (
  service: InquiryService,
  type: InquiryType,
  source: InquirySourceFields,
  target: InquiryTargetFields,
  content: Record<string, unknown>,
): Promise<void> => {
  if (service.validate) await service.validate({ ...source, ...target }, content);
  if (service.unique) await validateUniqueInquiry({ type, ...source, ...target }, service.unique);
};
