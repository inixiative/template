import type { HydratedRecord, Prisma } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { adminInquiryCreateRoute } from '#/modules/inquiry/routes/adminInquiryCreate';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { resolveInquiryTarget } from '#/modules/inquiry/services/resolveInquiryTarget';
import { validateInquiryPreCreate } from '#/modules/inquiry/services/validateInquiryPreCreate';
import { validateInquiryHandler } from '#/modules/inquiry/validations/validateInquiryHandler';

const source = { sourceModel: InquiryResourceModel.admin };

export const adminInquiryCreateController = makeController(adminInquiryCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const { targetEmail: _targetEmail, ...body } = c.req.valid('json');

  const handler = inquiryHandlers[body.type];
  const content = handler.contentSchema.parse(body.content);
  validateInquiryHandler(handler, source.sourceModel, body.targetModel);
  const target = await resolveInquiryTarget(c);

  const partial = await hydrate(db, 'inquiry', {
    id: '',
    type: body.type,
    content,
    ...source,
    ...target,
  } as HydratedRecord);
  if (!check(permix, rebacSchema, 'inquiry', partial, 'send'))
    throw makeError({ status: 403, message: 'Access denied' });

  await validateInquiryPreCreate(db, handler, body.type, source, target, content);

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      content: content as Prisma.InputJsonValue,
      ...source,
      ...target,
      sentAt: body.status === InquiryStatus.sent ? new Date() : null,
      expiresAt: body.status === InquiryStatus.sent ? computeExpiresAt(body.type) : null,
    },
    include: includeInquirySent,
  });

  return respond.created(inquiry);
});
