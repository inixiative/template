import type { HydratedRecord, UserId } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryCreateRoute } from '#/modules/inquiry/routes/inquiryCreate';
import { resolveInquirySource } from '#/modules/inquiry/services/resolveInquirySource';
import { resolveInquiryTarget } from '#/modules/inquiry/services/resolveInquiryTarget';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';

export const inquiryCreateController = makeController(inquiryCreateRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const permix = c.get('permix');
  const requestId = c.get('requestId');
  const { targetEmail, ...body } = c.req.valid('json');

  const handler = inquiryHandlers[body.type];
  const content = handler.contentSchema.parse(body.content);

  const source = resolveInquirySource(handler.sources[0], content, user.id as UserId);
  const target = await resolveInquiryTarget(db, handler.targets[0], content, { targetUserId: body.targetUserId as UserId, targetEmail });

  const partial = await hydrate(db, 'inquiry', {
    id: '',
    type: body.type,
    ...source,
    ...target,
  } as HydratedRecord);

  if (!check(permix, rebacSchema, 'inquiry', partial, 'send')) {
    throw makeError({ status: 403, message: 'Access denied', requestId });
  }

  if (handler.validate) {
    await handler.validate(db, { ...source, ...target, content } as Parameters<typeof handler.validate>[1]);
  }

  if (handler.unique) {
    await validateUniqueInquiry(db, { type: body.type, ...source, ...target }, requestId);
  }

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      content,
      ...source,
      ...target,
      sentAt: body.status === InquiryStatus.sent ? new Date() : null,
    },
  });

  return respond.created(inquiry);
});
