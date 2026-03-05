import { z } from 'zod';
import { Role, InquiryResourceModel } from '@template/db/generated/client/enums';
import type { Db, OrganizationId, UserId } from '@template/db';
import { makeError } from '#/lib/errors';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';

type InviteOrganizationUserContent = z.infer<typeof contentSchema>;

const contentSchema = z.object({
  role: z.nativeEnum(Role).default('member'),
});

export const inviteOrganizationUserHandler: InquiryHandler<InviteOrganizationUserContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Organization }],
  targets: [{ targetModel: InquiryResourceModel.User }],
  contentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'targeted',

  validate: async (db: Db, inquiry: Partial<Inquiry>, _content: InviteOrganizationUserContent) => {
    const organizationId = inquiry.sourceOrganizationId! as OrganizationId;
    const userId = inquiry.targetUserId! as UserId;

    const existing = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

    if (existing) throw makeError({ status: 409, message: 'User is already a member of this organization' });
  },

  handleApprove: async (db: Db, inquiry: Inquiry, resolvedContent: InviteOrganizationUserContent) => {
    await db.organizationUser.create({
      data: {
        organizationId: inquiry.sourceOrganizationId as OrganizationId,
        userId: inquiry.targetUserId! as UserId,
        role: resolvedContent.role,
      },
    });
  },
};
