import type { HydratedRecord, Prisma } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';
import { validateInquiryIsEditable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryUpdateController = makeController(inquiryUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const inquiry = getResource<'inquiry'>(c);
  const { content, ...rest } = c.req.valid('json');

  validateInquiryIsEditable(inquiry);

  const handler = inquiryHandlers[inquiry.type];
  const effectiveContent = handler.contentSchema.parse(content ?? inquiry.content);
  if (handler.validate) await handler.validate(db, inquiry, effectiveContent);

  const partial = await hydrate(db, 'inquiry', { ...inquiry, content: effectiveContent } as HydratedRecord);
  if (!check(permix, rebacSchema, 'inquiry', partial, 'send')) throw makeError({ status: 403, message: 'Access denied' });

  const updated = await db.inquiry.update({
    where: { id: inquiry.id },
    data: {
      ...rest,
      ...(content !== undefined && { content: content as Prisma.InputJsonValue }),
      ...(rest.status === InquiryStatus.sent && !inquiry.sentAt ? { sentAt: new Date() } : {}),
    },
  });

  return respond.ok(updated);
});
