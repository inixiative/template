/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryCancelRoute } from '#/modules/inquiry/routes/inquiryCancel';
import { lockInquiryAtVersion } from '#/modules/inquiry/services/lockInquiryAtVersion';
import { validateInquiryIsCancelable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryCancelController = makeController(inquiryCancelRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const { expectedUpdatedAt } = c.req.valid('query');

  await db.txn(async () => {
    validateInquiryIsCancelable(await lockInquiryAtVersion(inquiry.id, expectedUpdatedAt));
    await db.inquiry.update({
      where: { id: inquiry.id },
      data: { status: InquiryStatus.canceled, expiresAt: null, deletedAt: new Date() },
    });
  });

  return respond.noContent();
});
