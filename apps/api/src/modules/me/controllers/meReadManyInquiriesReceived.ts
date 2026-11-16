/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 */
import { whereAxisIsOwnerOrItsDelegate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
import { meReadManyInquiriesReceivedRoute } from '#/modules/me/routes/meReadManyInquiriesReceived';

export const meReadManyInquiriesReceivedController = makeController(
  meReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisIsOwnerOrItsDelegate('Inquiry', 'targetModel', { userId: me(c)!.id }),
        status: { notIn: [InquiryStatus.draft, InquiryStatus.canceled] },
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryReceived,
    });
    return respond.ok(data, { pagination });
  },
);
