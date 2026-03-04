import type { HydratedRecord, Prisma } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { adminInquiryCreateRoute } from '#/modules/inquiry/routes/adminInquiryCreate';
import { resolveInquiryTarget } from '#/modules/inquiry/services/resolveInquiryTarget';
import { validateInquiryHandler } from '#/modules/inquiry/validations/validateInquiryHandler';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';

const source = { sourceModel: InquiryResourceModel.admin };

export const adminInquiryCreateController = makeController(adminInquiryCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const { targetEmail: _targetEmail, ...body } = c.req.valid('json');

  const handler = inquiryHandlers[body.type];
  const content = handler.contentSchema.parse(body.content);
  validateInquiryHandler(handler, source.sourceModel, body.targetModel);
  const target = await resolveInquiryTarget(c, handler);

  const partial = await hydrate(db, 'inquiry', { id: '', type: body.type, content, ...source, ...target } as HydratedRecord);
  if (!check(permix, rebacSchema, 'inquiry', partial, 'send')) throw makeError({ status: 403, message: 'Access denied' });

  if (handler.validate) await handler.validate(db, { ...source, ...target, content } as Parameters<typeof handler.validate>[1]);
  if (handler.unique) await validateUniqueInquiry(db, { type: body.type, ...source, ...target });

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      content: content as Prisma.InputJsonValue,
      ...source,
      ...target,
      sentAt: body.status === InquiryStatus.sent ? new Date() : null,
    },
  });

  return respond.created(inquiry);
});
