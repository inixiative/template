import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { inviteOrganizationUserContentSchema } from '#/modules/inquiry/handlers/inviteOrganizationUser/contentSchema';
import { inviteOrganizationUserResolutionSchema } from '#/modules/inquiry/handlers/inviteOrganizationUser/resolutionSchema';
import { handleApprove } from '#/modules/inquiry/handlers/inviteOrganizationUser/handleApprove';
import { validate } from '#/modules/inquiry/handlers/inviteOrganizationUser/validate';

export const inviteOrganizationUserHandler: InquiryHandler = {
  contentSchema: inviteOrganizationUserContentSchema,
  resolutionSchema: inviteOrganizationUserResolutionSchema,
  handleApprove,
  validate,
  unique: true,
};
