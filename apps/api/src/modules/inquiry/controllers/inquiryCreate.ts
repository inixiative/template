import type { InquiryResourceModel } from '@template/db';
import { HTTPException } from 'hono/http-exception';
import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { inquiryCreateRoute } from '#/modules/inquiry/routes/inquiryCreate';

export const inquiryCreateController = makeController(inquiryCreateRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const body = c.req.valid('json');

  const sourceModel: InquiryResourceModel = body.type === 'memberApplication' ? 'User' : 'Organization';
  const sourceOrgId =
    body.type === 'memberInvitation' ? (body.content as { organizationId?: string })?.organizationId : null;

  if (body.type === 'memberInvitation') {
    if (!sourceOrgId) {
      throw new HTTPException(400, { message: 'Organization ID required in content' });
    }
    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: sourceOrgId, userId: user.id } },
    });
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new HTTPException(403, { message: 'Requires admin or owner role to invite' });
    }
  }

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      sourceModel,
      sourceUserId: sourceModel === 'User' ? user.id : null,
      sourceOrganizationId: sourceModel === 'Organization' ? sourceOrgId : null,
      sentAt: body.status === 'sent' ? new Date() : null,
    },
  });

  return respond.created(inquiry);
});
