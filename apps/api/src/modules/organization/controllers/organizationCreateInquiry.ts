import type { HydratedRecord, Prisma } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { resolveInquirySource } from '#/modules/inquiry/services/resolveInquirySource';
import { resolveInquiryTarget } from '#/modules/inquiry/services/resolveInquiryTarget';
import { validateInquiryPreCreate } from '#/modules/inquiry/services/validateInquiryPreCreate';
import { validateInquiryHandler } from '#/modules/inquiry/validations/validateInquiryHandler';
import { organizationCreateInquiryRoute } from '#/modules/organization/routes/organizationCreateInquiry';

export const organizationCreateInquiryController = makeController(
  organizationCreateInquiryRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const { targetEmail: _targetEmail, ...body } = c.req.valid('json');

    const handler = inquiryHandlers[body.type];
    const content = handler.contentSchema.parse(body.content);
    const source = resolveInquirySource(c);
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
      include: { targetUser: true, targetOrganization: true, targetSpace: true },
    });

    return respond.created(inquiry);
  },
);
