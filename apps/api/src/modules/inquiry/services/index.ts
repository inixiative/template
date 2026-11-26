import type { InquiryType } from '@template/db/generated/client/enums';
import { changeEntitlementsService } from '#/modules/inquiry/services/changeEntitlements';
import { createSpaceService } from '#/modules/inquiry/services/createSpace';
import { inviteOrganizationUserService } from '#/modules/inquiry/services/inviteOrganizationUser';
import { transferArtifactService } from '#/modules/inquiry/services/transferArtifact';
import { transferSpaceService } from '#/modules/inquiry/services/transferSpace';
import type { InquiryService } from '#/modules/inquiry/services/types';
import { updateSpaceService } from '#/modules/inquiry/services/updateSpace';

export const inquiryServices: Record<InquiryType, InquiryService> = {
  inviteOrganizationUser: inviteOrganizationUserService,
  createSpace: createSpaceService,
  updateSpace: updateSpaceService,
  transferSpace: transferSpaceService,
  transferArtifact: transferArtifactService,
  changeEntitlements: changeEntitlementsService,
};
