/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryRevokeRoute } from '#/modules/inquiry/routes/inquiryRevoke';
import { validateInquiryIsRevocable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryRevokeController = makeController(inquiryRevokeRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);

  validateInquiryIsRevocable(inquiry, inquiryHandlers[inquiry.type]);

  await db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: InquiryStatus.revoked },
  });

  return respond.noContent();
});
