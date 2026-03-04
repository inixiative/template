import type { OrganizationId, SpaceId, UserId } from '@template/db';
import type { Context } from 'hono';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { AppEnv } from '#/types/appEnv';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

type InquiryTargetFields = {
  targetModel: InquiryResourceModel;
  targetUserId: UserId | null;
  targetOrganizationId: OrganizationId | null;
  targetSpaceId: SpaceId | null;
};

type TargetBody = {
  targetUserId?: string | null;
  targetEmail?: string | null;
};

export const resolveInquiryTarget = async (
  c: Context<AppEnv>,
  handler: InquiryHandler,
  content: Record<string, unknown>,
  body: TargetBody,
): Promise<InquiryTargetFields> => {
  const target = handler.targets[0];
  if (target.targetModel === InquiryResourceModel.User) {
    const targetUserId: UserId | null = body.targetUserId
      ? body.targetUserId as UserId
      : body.targetEmail
        ? (await findUserOrCreateGuest(c, { email: body.targetEmail })).id as UserId
        : null;
    return { targetModel: target.targetModel, targetUserId, targetOrganizationId: null, targetSpaceId: null };
  }
  if ('targetOrganizationId' in target) {
    return {
      targetModel: target.targetModel,
      targetUserId: null,
      targetOrganizationId: content[target.targetOrganizationId] as OrganizationId,
      targetSpaceId: null,
    };
  }
  if ('targetSpaceId' in target) {
    return {
      targetModel: target.targetModel,
      targetUserId: null,
      targetOrganizationId: null,
      targetSpaceId: content[target.targetSpaceId] as SpaceId,
    };
  }
  // admin
  return { targetModel: target.targetModel, targetUserId: null, targetOrganizationId: null, targetSpaceId: null };
};
