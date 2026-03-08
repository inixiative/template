import type { OrganizationId, SpaceId, UserId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { getValidatedBody, type ValidatedContext } from '#/lib/context/getValidatedData';
import { makeError } from '#/lib/errors';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

const nullTargetFields = { targetUserId: null, targetOrganizationId: null, targetSpaceId: null };
type InquiryTargetBody = {
  targetModel: InquiryResourceModel;
  targetUserId?: string;
  targetOrganizationId?: string;
  targetSpaceId?: string;
  targetEmail?: string;
  targetOrganizationSlug?: string;
  targetSpaceSlug?: string;
};

export type InquiryTargetFields =
  | { targetModel: (typeof InquiryResourceModel)['User']; targetUserId: UserId }
  | { targetModel: (typeof InquiryResourceModel)['Organization']; targetOrganizationId: OrganizationId }
  | { targetModel: (typeof InquiryResourceModel)['Space']; targetSpaceId: SpaceId }
  | { targetModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquiryTarget = async <C extends ValidatedContext<'json', InquiryTargetBody>>(
  c: C,
): Promise<InquiryTargetFields> => {
  const db = c.get('db');
  const body = getValidatedBody(c);
  const targetModel: InquiryResourceModel = body.targetModel;

  if (targetModel === InquiryResourceModel.User) {
    if (body.targetUserId) {
      const user = await db.user.findUnique({ where: { id: body.targetUserId as UserId } });
      if (!user) throw makeError({ status: 404, message: 'Target user not found' });
      return { ...nullTargetFields, targetModel, targetUserId: user.id as UserId };
    }
    if (body.targetEmail) {
      const user = await findUserOrCreateGuest(c, { email: body.targetEmail as string });
      return { ...nullTargetFields, targetModel, targetUserId: user.id as UserId };
    }
    throw makeError({ status: 422, message: 'targetUserId or targetEmail is required' });
  }

  if (targetModel === InquiryResourceModel.Organization) {
    if (body.targetOrganizationId) {
      const org = await db.organization.findUnique({ where: { id: body.targetOrganizationId as OrganizationId } });
      if (!org) throw makeError({ status: 404, message: 'Target organization not found' });
      return { ...nullTargetFields, targetModel, targetOrganizationId: org.id as OrganizationId };
    }
    if (body.targetOrganizationSlug) {
      const org = await db.organization.findUnique({ where: { slug: body.targetOrganizationSlug as string } });
      if (!org) throw makeError({ status: 404, message: 'Target organization not found' });
      return { ...nullTargetFields, targetModel, targetOrganizationId: org.id as OrganizationId };
    }
    throw makeError({ status: 422, message: 'targetOrganizationId or targetOrganizationSlug is required' });
  }

  if (targetModel === InquiryResourceModel.Space) {
    if (body.targetSpaceId) {
      const space = await db.space.findUnique({ where: { id: body.targetSpaceId as SpaceId } });
      if (!space) throw makeError({ status: 404, message: 'Target space not found' });
      return { ...nullTargetFields, targetModel, targetSpaceId: space.id as SpaceId };
    }
    if (body.targetOrganizationSlug && body.targetSpaceSlug) {
      const space = await db.space.findFirst({
        where: { slug: body.targetSpaceSlug as string, organization: { slug: body.targetOrganizationSlug as string } },
      });
      if (!space) throw makeError({ status: 404, message: 'Target space not found' });
      return { ...nullTargetFields, targetModel, targetSpaceId: space.id as SpaceId };
    }
    throw makeError({ status: 422, message: 'targetSpaceId or targetOrganizationSlug + targetSpaceSlug is required' });
  }

  return { ...nullTargetFields, targetModel };
};
