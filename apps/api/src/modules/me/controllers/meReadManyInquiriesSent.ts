/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 */
import { whereAxisCarriesOwnerKeys } from '@template/db';
import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { meReadManyInquiriesSentRoute } from '#/modules/me/routes/meReadManyInquiriesSent';

export const meReadManyInquiriesSentController = makeController(
  meReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisCarriesOwnerKeys('Inquiry', 'sourceModel', { userId: me(c)!.id }),
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryResponse,
    });
    return respond.ok(data, { pagination });
  },
);
