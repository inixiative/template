import type { HydratedRecord } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryCreateRoute } from '#/modules/inquiry/routes/inquiryCreate';
import { assertInquiryPermission } from '#/modules/inquiry/services/utils/assertInquiryPermission';
import { assertUniqueInquiry } from '#/modules/inquiry/services/utils/assertUniqueInquiry';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

export const inquiryCreateController = makeController(inquiryCreateRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const permix = c.get('permix');
  const requestId = c.get('requestId');
  const { targetEmail, ...body } = c.req.valid('json');

  const handler = inquiryHandlers[body.type];

  const parsedContent = handler.contentSchema.safeParse(body.content);
  if (!parsedContent.success) {
    throw makeError({ status: 400, message: 'Invalid content for this inquiry type', requestId });
  }

  let sourceModel: InquiryResourceModel = InquiryResourceModel.User;
  let sourceUserId: string | null = user.id;
  let sourceOrganizationId: string | null = null;
  let sourceSpaceId: string | null = null;

  if (body.type === InquiryType.inviteOrganizationUser || body.type === InquiryType.createSpace) {
    sourceModel = InquiryResourceModel.Organization;
    sourceUserId = null;
    sourceOrganizationId = parsedContent.data.organizationId as string;
  } else if (body.type === InquiryType.updateSpace || body.type === InquiryType.transferSpace) {
    sourceModel = InquiryResourceModel.Space;
    sourceUserId = null;
    sourceSpaceId = parsedContent.data.spaceId as string;
  }

  const targetUserId = body.targetUserId ?? (targetEmail ? (await findUserOrCreateGuest(db, { email: targetEmail })).id : null);
  const targetModel: InquiryResourceModel | null = targetUserId ? InquiryResourceModel.User : null;

  await assertInquiryPermission(
    db,
    permix,
    {
      id: '',
      type: body.type,
      sourceModel,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetModel,
      targetUserId: targetUserId ?? null,
      targetOrganizationId: null,
      targetSpaceId: null,
    } as HydratedRecord,
    'send',
    requestId,
  );

  if (handler.validate) {
    const partialInquiry = {
      sourceModel,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetModel,
      targetUserId: targetUserId ?? null,
      targetOrganizationId: null,
      targetSpaceId: null,
      content: parsedContent.data,
    } as Parameters<typeof handler.validate>[1];
    await handler.validate(db, partialInquiry);
  }

  if (handler.unique) {
    await assertUniqueInquiry(db, {
      type: body.type,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetUserId,
    }, requestId);
  }

  const inquiry = await db.inquiry.create({
    data: {
      ...body,
      content: parsedContent.data,
      sourceModel,
      sourceUserId,
      sourceOrganizationId,
      sourceSpaceId,
      targetModel,
      targetUserId: targetUserId ?? null,
      sentAt: body.status === InquiryStatus.sent ? new Date() : null,
    },
  });

  return respond.created(inquiry);
});
