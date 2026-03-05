import type { OrganizationId, SpaceId, UserId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { getValidatedBody } from '#/lib/context/getValidatedData';
import { makeError } from '#/lib/errors';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';
import type { AppEnv } from '#/types/appEnv';

const nullTargetFields = { targetUserId: null, targetOrganizationId: null, targetSpaceId: null };

export type InquiryTargetFields =
  | { targetModel: (typeof InquiryResourceModel)['User']; targetUserId: UserId }
  | { targetModel: (typeof InquiryResourceModel)['Organization']; targetOrganizationId: OrganizationId }
  | { targetModel: (typeof InquiryResourceModel)['Space']; targetSpaceId: SpaceId }
  | { targetModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquiryTarget = async (c: Context<AppEnv>, handler: InquiryHandler): Promise<InquiryTargetFields> => {
  const db = c.get('db');
  const body = getValidatedBody(c);
  const target = handler.targets[0];

  if (target.targetModel === InquiryResourceModel.User) {
    if (body.targetUserId) {
      const user = await db.user.findUnique({ where: { id: body.targetUserId as UserId } });
      if (!user) throw makeError({ status: 404, message: 'Target user not found' });
      return { ...nullTargetFields, targetModel: target.targetModel, targetUserId: user.id as UserId };
    }
    if (body.targetEmail) {
      const user = await findUserOrCreateGuest(c, { email: body.targetEmail as string });
      return { ...nullTargetFields, targetModel: target.targetModel, targetUserId: user.id as UserId };
    }
    throw makeError({ status: 422, message: 'targetUserId or targetEmail is required' });
  }

  if (target.targetModel === InquiryResourceModel.Organization) {
    const orgId = body.targetOrganizationId as OrganizationId;
    if (!orgId) throw makeError({ status: 422, message: 'targetOrganizationId is required' });
    const org = await db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw makeError({ status: 404, message: 'Target organization not found' });
    return { ...nullTargetFields, targetModel: target.targetModel, targetOrganizationId: org.id as OrganizationId };
  }

  if (target.targetModel === InquiryResourceModel.Space) {
    const spaceId = body.targetSpaceId as SpaceId;
    if (!spaceId) throw makeError({ status: 422, message: 'targetSpaceId is required' });
    const space = await db.space.findUnique({ where: { id: spaceId } });
    if (!space) throw makeError({ status: 404, message: 'Target space not found' });
    return { ...nullTargetFields, targetModel: target.targetModel, targetSpaceId: space.id as SpaceId };
  }

  return { ...nullTargetFields, targetModel: target.targetModel };
};
