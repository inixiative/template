import type { Db, OrganizationId, UserId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const handleApprove = async (
  db: Db,
  inquiry: Inquiry,
  resolvedContent: Record<string, unknown>,
): Promise<void> => {
  const organizationId = inquiry.sourceOrganizationId as OrganizationId;
  const role = (resolvedContent.role as Role) ?? 'member';
  const userId = inquiry.targetUserId! as UserId;

  await db.organizationUser.create({
    data: { organizationId, userId, role },
  });
};
