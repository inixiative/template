import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import { inviteOrganizationUserContentSchema, type InviteOrganizationUserContent } from '#/modules/inquiry/handlers/inviteOrganizationUser/contentSchema';
import { handleApprove } from '#/modules/inquiry/handlers/inviteOrganizationUser/handleApprove';
import { validate } from '#/modules/inquiry/handlers/inviteOrganizationUser/validate';

export const inviteOrganizationUserHandler: InquiryHandler<InviteOrganizationUserContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Organization }],
  targets: [{ targetModel: InquiryResourceModel.User }],
  contentSchema: inviteOrganizationUserContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  handleApprove,
  validate,
  unique: 'targeted',
};
