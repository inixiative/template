import type { Db } from '@template/db';
import type { InquiryType } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import type { InquirySourceFields } from '#/modules/inquiry/services/resolveInquirySource';
import type { InquiryTargetFields } from '#/modules/inquiry/services/resolveInquiryTarget';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';

export const validateInquiryPreCreate = async (
  db: Db,
  handler: InquiryHandler,
  type: InquiryType,
  source: InquirySourceFields,
  target: InquiryTargetFields,
  content: Record<string, unknown>,
): Promise<void> => {
  if (handler.validate) await handler.validate(db, { ...source, ...target }, content);
  if (handler.unique === 'targeted') await validateUniqueInquiry(db, { type, ...source, ...target });
  if (handler.unique === 'untargeted') await validateUniqueInquiry(db, { type, ...source });
};
