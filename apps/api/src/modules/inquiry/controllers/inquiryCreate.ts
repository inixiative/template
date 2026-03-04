import type { HydratedRecord } from '@template/db';
import { hydrate } from '@template/db';
import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryCreateRoute } from '#/modules/inquiry/routes/inquiryCreate';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

export const inquiryCreateController = makeController(inquiryCreateRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const permix = c.get('permix');
  const requestId = c.get('requestId');
  const { targetEmail, ...body } = c.req.valid('json');

  const handler = inquiryHandlers[body.type];
  const content = handler.contentSchema.parse(body.content);

  // Derive source fields from handler meta
  let sourceModel: InquiryResourceModel = InquiryResourceModel.User;
  let sourceUserId: string | null = user.id;
  let sourceOrganizationId: string | null = null;
  let sourceSpaceId: string | null = null;

  const [source] = handler.sources;
  if ('sourceOrganizationId' in source) {
    sourceModel = source.sourceModel;
    sourceUserId = null;
    sourceOrganizationId = content[source.sourceOrganizationId] as string;
  } else if ('sourceSpaceId' in source) {
    sourceModel = source.sourceModel;
    sourceUserId = null;
    sourceSpaceId = content[source.sourceSpaceId] as string;
  }

  // Derive target fields from request + handler meta
  const targetUserId = body.targetUserId ?? (targetEmail ? (await findUserOrCreateGuest(db, { email: targetEmail })).id : null);
  const [target] = handler.targets;
  const targetModel = target.targetModel;
  const targetOrganizationId = target && 'targetOrganizationId' in target ? content[target.targetOrganizationId] as string : null;
  const targetSpaceId = target && 'targetSpaceId' in target ? content[target.targetSpaceId] as string : null;

  const partial = await hydrate(db, 'inquiry', {
    id: '',
    type: body.type,
    sourceModel,
    sourceUserId,
    sourceOrganizationId,
    sourceSpaceId,
    targetModel,
    targetUserId: targetUserId ?? null,
    targetOrganizationId,
    targetSpaceId,
  } as HydratedRecord);

  if (!check(permix, rebacSchema, 'inquiry', partial, 'send')) {
    throw makeError({ status: 403, message: 'Access denied', requestId });
  }

  if (handler.validate) {
    const partialInquiry = {
      sourceModel,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetModel,
      targetUserId: targetUserId ?? null,
      targetOrganizationId,
      targetSpaceId,
      content,
    } as Parameters<typeof handler.validate>[1];
    await handler.validate(db, partialInquiry);
  }

  if (handler.unique) {
    await validateUniqueInquiry(db, {
      type: body.type,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetUserId,
      targetOrganizationId,
      targetSpaceId,
    }, requestId);
  }

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      content,
      sourceModel,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetModel,
      targetUserId: targetUserId ?? null,
      targetOrganizationId,
      targetSpaceId,
      sentAt: body.status === InquiryStatus.sent ? new Date() : null,
    },
  });

  return respond.created(inquiry);
});
