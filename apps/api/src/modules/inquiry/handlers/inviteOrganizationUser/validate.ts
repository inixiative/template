import type { Db, OrganizationId, UserId } from '@template/db';
import { makeError } from '#/lib/errors';
import type { Inquiry } from '#/modules/inquiry/handlers/types';
import type { InviteOrganizationUserContent } from '#/modules/inquiry/handlers/inviteOrganizationUser/contentSchema';

export const validate = async (db: Db, inquiry: Inquiry, _content: InviteOrganizationUserContent): Promise<void> => {
  const organizationId = inquiry.sourceOrganizationId! as OrganizationId;
  const userId = inquiry.targetUserId! as UserId;

  const existing = await db.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (existing) throw makeError({ status: 409, message: 'User is already a member of this organization' });
};
