/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses primitive:authz, infrastructure:prisma, primitive:appEvents
 */
import type { z } from '@hono/zod-openapi';
import type { HydratedRecord, Prisma } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { ValidatedContext } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import type {
  inquiryCreateBodySchema,
  inquiryCreateServerOwnedKeys,
} from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquiryServices } from '#/modules/inquiry/services';
import type { InquirySourceFields } from '#/modules/inquiry/services/resolveInquirySource';
import { resolveInquiryTarget } from '#/modules/inquiry/services/resolveInquiryTarget';
import { sendInquiry } from '#/modules/inquiry/services/sendInquiry';
import { validateInquiryPreCreate } from '#/modules/inquiry/services/validateInquiryPreCreate';
import { validateInquiryTypeAcceptsSourceAndTargetModels } from '#/modules/inquiry/validations/validateInquiryTypeAcceptsSourceAndTargetModels';

type InquiryCreateBody = Omit<
  z.output<typeof inquiryCreateBodySchema>,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | (typeof inquiryCreateServerOwnedKeys)[number]
>;

export const createInquiry = async (
  c: ValidatedContext<'json', InquiryCreateBody>,
  source: InquirySourceFields,
) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const { targetEmail: _targetEmail, status, ...body } = c.req.valid('json');

  const service = inquiryServices[body.type];
  const content = service.contentSchema.parse(body.content);
  validateInquiryTypeAcceptsSourceAndTargetModels(body.type, source.sourceModel, body.targetModel);
  const target = await resolveInquiryTarget(c);

  const partial = await hydrate('inquiry', {
    id: '',
    type: body.type,
    content,
    ...source,
    ...target,
  } as HydratedRecord);
  if (!check(permix, rebacSchema, 'inquiry', partial, 'send'))
    throw makeError({ status: 403, message: 'Access denied' });

  await validateInquiryPreCreate(service, body.type, source, target, content, permix);

  return db.txn(async () => {
    const draft = await db.inquiry.create({
      data: {
        ...body,
        content: content as Prisma.InputJsonValue,
        ...source,
        ...target,
        status: InquiryStatus.draft,
      },
      include: includeInquiryResponse,
    });

    if (status === InquiryStatus.sent) return sendInquiry(c, draft);
    return draft;
  });
};
