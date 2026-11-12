/**
 * @atlas
 * @kind validator
 * @partOf feature:inquiry
 * @uses primitive:authz
 */
import type { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { INQUIRY_TYPES } from '@template/permissions';
import { makeError } from '#/lib/errors';

// The parties a type accepts are declared once, with their permission levels, in
// @template/permissions (INQUIRY_TYPES); this asks the same declarations.
export const validateInquiryHandler = (
  type: InquiryType,
  sourceModel: InquiryResourceModel,
  targetModel: InquiryResourceModel,
): void => {
  const { sources, targets } = INQUIRY_TYPES[type];

  if (!sources.some((party) => party.model === sourceModel))
    throw makeError({ status: 422, message: 'Inquiry type does not support this source' });

  if (!targets.some((party) => party.model === targetModel))
    throw makeError({ status: 422, message: 'Inquiry type does not support this target' });
};
