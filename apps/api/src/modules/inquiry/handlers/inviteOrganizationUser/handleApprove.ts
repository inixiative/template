import type { Db, OrganizationId, UserId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const handleApprove = async (
  db: Db,
  inquiry: Inquiry,
  _resolvedContent: Record<string, unknown>,
): Promise<void> => {
  const content = inquiry.content as Record<string, unknown>;
  const organizationId = (inquiry.sourceOrganizationId ?? content.organizationId) as OrganizationId;
  const role = ((content.role as Role) ?? 'member');
  const userId = inquiry.targetUserId! as UserId;

  await db.organizationUser.create({
    data: { organizationId, userId, role },
  });
};
