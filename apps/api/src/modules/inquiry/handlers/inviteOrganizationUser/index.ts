import type { Db, OrganizationId, UserId } from '@template/db';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import { z } from 'zod';
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

  onSent: (inquiry) => {
    if (!inquiry.targetUserId) return null;
    const content = contentSchema.parse(inquiry.content);
    return [
      {
        target: { userIds: [inquiry.targetUserId] },
        message: {
          template: 'org-invitation',
          data: {
            inquiryId: inquiry.id,
            sourceOrganizationId: inquiry.sourceOrganizationId,
            sourceUserId: inquiry.sourceUserId,
            role: content.role,
          },
        },
        tags: ['inquiry', 'invitation'],
        category: 'system' as const,
        sender: {
          ownerModel: 'Organization' as const,
          organizationId: inquiry.sourceOrganizationId ?? undefined,
        },
      },
    ];
  },

  onSentWS: (inquiry) => {
    if (!inquiry.targetUserId) return null;
    return [
      {
        target: { userIds: [inquiry.targetUserId] },
        message: {
          data: {
            event: 'inquiry.sent',
            inquiryId: inquiry.id,
            type: inquiry.type,
          },
        },
      },
    ];
  },

  onResolvedWS: (inquiry) => {
    const targets: string[] = [];
    if (inquiry.sourceUserId) targets.push(inquiry.sourceUserId);
    if (inquiry.targetUserId) targets.push(inquiry.targetUserId);
    if (!targets.length) return null;
    return [
      {
        target: { userIds: targets },
        message: {
          data: {
            event: 'inquiry.resolved',
            inquiryId: inquiry.id,
            type: inquiry.type,
            status: inquiry.status,
          },
        },
      },
    ];
  },
};
