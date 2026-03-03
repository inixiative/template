import type { InquiryType } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { inviteOrganizationUserHandler } from '#/modules/inquiry/handlers/inviteOrganizationUser';
import { createSpaceHandler } from '#/modules/inquiry/handlers/createSpace';
import { updateSpaceHandler } from '#/modules/inquiry/handlers/updateSpace';
import { transferSpaceHandler } from '#/modules/inquiry/handlers/transferSpace';

export const inquiryHandlers: Record<InquiryType, InquiryHandler> = {
  inviteOrganizationUser: inviteOrganizationUserHandler,
  createSpace: createSpaceHandler,
  updateSpace: updateSpaceHandler,
  transferSpace: transferSpaceHandler,
};
