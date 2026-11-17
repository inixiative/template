/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 */
import { whereAxisCarriesOwnerKeys } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { meReadManyInquiriesReceivedRoute } from '#/modules/me/routes/meReadManyInquiriesReceived';

export const meReadManyInquiriesReceivedController = makeController(
  meReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisCarriesOwnerKeys('Inquiry', 'targetModel', { userId: me(c)!.id }),
        status: { notIn: [InquiryStatus.draft, InquiryStatus.canceled] },
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryResponse,
    });
    return respond.ok(data, { pagination });
  },
);
