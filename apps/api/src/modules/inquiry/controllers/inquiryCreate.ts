import type { InquiryResourceModel } from '@template/db';
import { makeError } from '#/lib/errors';

import { makeController } from '#/lib/utils/makeController';
import { inquiryCreateRoute } from '#/modules/inquiry/routes/inquiryCreate';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

export const inquiryCreateController = makeController(inquiryCreateRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { targetEmail, ...body } = c.req.valid('json');

  // TODO: Refactor for new inquiry types (inviteOrganizationUser, createSpace, updateSpace, transferSpace)
  const sourceModel: InquiryResourceModel = 'Organization';
  const sourceOrgId =
    body.type === 'inviteOrganizationUser' ? (body.content as { organizationId?: string })?.organizationId : null;

  if (body.type === 'inviteOrganizationUser') {
    if (!sourceOrgId) {
      throw makeError({ status: 400, message: 'Organization ID required in content', requestId: c.get('requestId') });
    }
    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: sourceOrgId, userId: user.id } },
    });
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw makeError({ status: 403, message: 'Requires admin or owner role to invite', requestId: c.get('requestId') });
    }
  }

  const targetUserId =
    body.targetUserId ?? (targetEmail ? (await findUserOrCreateGuest(db, { email: targetEmail })).id : null);

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      sourceModel,
      sourceUserId: sourceModel === 'User' ? user.id : null,
      sourceOrganizationId: sourceModel === 'Organization' ? sourceOrgId : null,
      targetUserId,
      sentAt: body.status === 'sent' ? new Date() : null,
    },
  });

  return respond.created(inquiry);
});
