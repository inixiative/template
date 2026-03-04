import type { InquiryResourceModel } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const validateInquiryHandler = (
  handler: InquiryHandler,
  sourceModel: InquiryResourceModel,
  targetModel: InquiryResourceModel,
): void => {
  if (!handler.sources.some((s) => s.sourceModel === sourceModel))
    throw makeError({ status: 422, message: 'Inquiry type does not support this source' });

  if (!handler.targets.some((t) => t.targetModel === targetModel))
    throw makeError({ status: 422, message: 'Inquiry type does not support this target' });
};
