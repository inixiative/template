/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates, primitive:authz, infrastructure:prisma
 */
import type { HydratedRecord, Prisma } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { check, schemaMap } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';
import { inquiryServices } from '#/modules/inquiry/services';
import { lockInquiryAtVersion } from '#/modules/inquiry/services/lockInquiryAtVersion';
import { sendInquiry } from '#/modules/inquiry/services/sendInquiry';
import { validateInquiryIsEditable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryUpdateController = makeController(inquiryUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const inquiry = contextResource<'inquiry'>(c);
  const { content, status, expectedUpdatedAt } = c.req.valid('json');

  const service = inquiryServices[inquiry.type];
  const effectiveContent = service.contentSchema.parse(content ?? inquiry.content);
  if (service.validate) await service.validate(inquiry, effectiveContent);

  const partial = await hydrate('inquiry', {
    ...inquiry,
    content: effectiveContent,
  } as HydratedRecord);
  if (!check(permix, schemaMap, 'inquiry', partial, 'send'))
    throw makeError({ status: 403, message: 'Access denied' });

  const updated = await db.txn(async () => {
    validateInquiryIsEditable(await lockInquiryAtVersion(inquiry.id, expectedUpdatedAt));
    const saved = await db.inquiry.update({
      where: { id: inquiry.id },
      data: {
        content: content === undefined ? undefined : (effectiveContent as Prisma.InputJsonValue),
        ...(status === InquiryStatus.draft && { status, expiresAt: null }),
      },
      include: includeInquiryResponse,
    });
    return status === InquiryStatus.sent ? sendInquiry(c, saved, saved.updatedAt) : saved;
  });

  return respond.ok(updated);
});
