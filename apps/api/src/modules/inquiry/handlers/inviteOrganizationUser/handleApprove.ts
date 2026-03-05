import type { Db, OrganizationId, UserId } from '@template/db';
import type { Inquiry } from '#/modules/inquiry/handlers/types';
import type { InviteOrganizationUserContent } from '#/modules/inquiry/handlers/inviteOrganizationUser/contentSchema';

export const handleApprove = async (
  db: Db,
  inquiry: Inquiry,
  resolvedContent: InviteOrganizationUserContent,
): Promise<void> => {
  const organizationId = inquiry.sourceOrganizationId as OrganizationId;
  const role = resolvedContent.role;
  const userId = inquiry.targetUserId! as UserId;

  await db.organizationUser.create({
    data: { organizationId, userId, role },
  });
};
