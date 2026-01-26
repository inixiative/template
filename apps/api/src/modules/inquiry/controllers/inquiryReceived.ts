import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { inquiryReceivedRoute } from '#/modules/inquiry/routes/inquiryReceived';
import { getUserOrganizationIds } from '#/modules/inquiry/services/access';

export const inquiryReceivedController = makeController(inquiryReceivedRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { page = 1, pageSize = 20 } = c.req.valid('query');

  const userOrgIds = await getUserOrganizationIds(db, user.id, ['owner', 'admin', 'member']);

  const where = {
    AND: [
      {
        OR: [
          { targetModel: 'User' as const, targetUserId: user.id },
          ...(userOrgIds.length > 0
            ? [{ targetModel: 'Organization' as const, targetOrganizationId: { in: userOrgIds } }]
            : []),
        ],
      },
      { status: { not: 'draft' as const } },
    ],
  };

  const [inquiries, total] = await Promise.all([
    db.inquiry.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    db.inquiry.count({ where }),
  ]);

  return respond.ok(inquiries, {
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});
