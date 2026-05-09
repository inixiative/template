import type { Db, OrganizationId, UserId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { inviteOrganizationUserAppEvents } from '#/modules/inquiry/handlers/inviteOrganizationUser/appEvents';
import { contentSchema, type InviteOrganizationUserContent } from '#/modules/inquiry/handlers/inviteOrganizationUser/schema';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';

export const inviteOrganizationUserHandler: InquiryHandler<InviteOrganizationUserContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Organization }],
  targets: [{ targetModel: InquiryResourceModel.User }],
  contentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'targeted',
  defaultExpirationDays: 30,

  validate: async (db: Db, inquiry: Partial<Inquiry>, _content: InviteOrganizationUserContent) => {
    const organizationId = inquiry.sourceOrganizationId! as OrganizationId;
    const userId = inquiry.targetUserId! as UserId;

    const existing = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

    if (existing) throw makeError({ status: 409, message: 'User is already a member of this organization' });
  },

  autoApprove: async () => false,

  handleApprove: async (db: Db, inquiry: Inquiry, resolvedContent: InviteOrganizationUserContent) => {
    await db.organizationUser.create({
      data: {
        organizationId: inquiry.sourceOrganizationId as OrganizationId,
        userId: inquiry.targetUserId! as UserId,
        role: resolvedContent.role,
      },
    });
  },

  appEvents: inviteOrganizationUserAppEvents,
};
