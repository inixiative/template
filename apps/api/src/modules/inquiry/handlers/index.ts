import type { InquiryType } from '@template/db/generated/client/enums';
import { createSpaceHandler } from '#/modules/inquiry/handlers/createSpace';
import { inviteOrganizationUserHandler } from '#/modules/inquiry/handlers/inviteOrganizationUser';
import { transferSpaceHandler } from '#/modules/inquiry/handlers/transferSpace';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { updateSpaceHandler } from '#/modules/inquiry/handlers/updateSpace';

export const inquiryHandlers: Record<InquiryType, InquiryHandler> = {
  inviteOrganizationUser: inviteOrganizationUserHandler,
  createSpace: createSpaceHandler,
  updateSpace: updateSpaceHandler,
  transferSpace: transferSpaceHandler,
};
