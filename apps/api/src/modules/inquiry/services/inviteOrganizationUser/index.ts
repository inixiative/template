import { db, revive } from '@template/db';
import {
  baseResolutionInputSchema,
  type InviteOrganizationUserContent,
  inviteOrganizationUserContentSchema,
} from '@template/shared/inquiry';
import { makeError } from '#/lib/errors';
import { inviteOrganizationUserAppEvents } from '#/modules/inquiry/services/inviteOrganizationUser/appEvents';
import type { Inquiry, InquiryService } from '#/modules/inquiry/services/types';

export const inviteOrganizationUserService: InquiryService<InviteOrganizationUserContent> = {
  contentSchema: inviteOrganizationUserContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'targeted',
  defaultExpirationDays: 30,

  validate: async (inquiry: Partial<Inquiry>, _content: InviteOrganizationUserContent) => {
    const organizationId = inquiry.sourceOrganizationId!;
    const userId = inquiry.targetUserId!;

    const existing = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

    if (existing)
      throw makeError({ status: 409, message: 'User is already a member of this organization' });
  },

  autoApprove: async () => false,

  handleApprove: async (_c, inquiry: Inquiry, content: InviteOrganizationUserContent) => {
    const organizationId = inquiry.sourceOrganizationId!;
    const userId = inquiry.targetUserId!;
    const [revived] = await revive(db.organizationUser, { organizationId, userId });
    if (revived)
      await db.organizationUser.update({
        where: { id: revived.id },
        data: { role: content.role },
      });
    else
      await db.organizationUser.create({
        data: { organizationId, userId, role: content.role },
      });
  },

  appEvents: inviteOrganizationUserAppEvents,
};
