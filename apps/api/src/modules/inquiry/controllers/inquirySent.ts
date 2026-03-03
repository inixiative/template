import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { inquirySentRoute } from '#/modules/inquiry/routes/inquirySent';
import { getUserOrganizationIds } from '#/modules/inquiry/services/access';

export const inquirySentController = makeController(inquirySentRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { page = 1, pageSize = 20 } = c.req.valid('query');

  const userOrgIds = await getUserOrganizationIds(db, user.id, [Role.owner, Role.admin]);

  const where = {
    OR: [
      { sourceModel: InquiryResourceModel.User, sourceUserId: user.id },
      ...(userOrgIds.length > 0
        ? [{ sourceModel: InquiryResourceModel.Organization, sourceOrganizationId: { in: userOrgIds } }]
        : []),
    ],
  };

  const [inquiries, total] = await Promise.all([
    db.inquiry.findMany({ where, take: pageSize, skip: (page - 1) * pageSize, orderBy: { createdAt: 'desc' } }),
    db.inquiry.count({ where }),
  ]);

  return respond.ok(inquiries, {
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});
