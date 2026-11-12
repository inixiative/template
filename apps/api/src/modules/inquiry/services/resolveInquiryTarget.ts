/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma, feature:tenancy, feature:users
 */
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { getValidatedBody, type ValidatedContext } from '#/lib/context/getValidatedData';
import { makeError } from '#/lib/errors';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

const nullTargetFields = {
  targetUserId: null,
  targetOrganizationId: null,
  targetSpaceId: null,
  targetIntegrationId: null,
  targetTokenId: null,
};
export type InquiryTargetBody = {
  targetModel: InquiryResourceModel;
  targetUserId?: string;
  targetOrganizationId?: string;
  targetSpaceId?: string;
  targetEmail?: string;
  targetOrganizationSlug?: string;
  targetSpaceSlug?: string;
};

export type InquiryTargetFields =
  | { targetModel: (typeof InquiryResourceModel)['User']; targetUserId: string }
  | {
      targetModel: (typeof InquiryResourceModel)['Organization'];
      targetOrganizationId: string;
    }
  | { targetModel: (typeof InquiryResourceModel)['Space']; targetSpaceId: string }
  | {
      targetModel: (typeof InquiryResourceModel)['OrganizationUser'];
      targetOrganizationId: string;
      targetUserId: string;
    }
  | {
      targetModel: (typeof InquiryResourceModel)['SpaceUser'];
      targetOrganizationId: string;
      targetSpaceId: string;
      targetUserId: string;
    }
  | { targetModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquiryTarget = async <C extends ValidatedContext<'json', InquiryTargetBody>>(
  c: C,
): Promise<InquiryTargetFields> => {
  const db = c.get('db');
  const body = getValidatedBody(c);
  const targetModel: InquiryResourceModel = body.targetModel;

  if (targetModel === InquiryResourceModel.User) {
    if (body.targetUserId) {
      const user = await db.user.findUnique({ where: { id: body.targetUserId } });
      if (!user) throw makeError({ status: 404, message: 'Target user not found' });
      return { ...nullTargetFields, targetModel, targetUserId: user.id };
    }
    if (body.targetEmail) {
      const user = await findUserOrCreateGuest(c, { email: body.targetEmail as string });
      return { ...nullTargetFields, targetModel, targetUserId: user.id };
    }
    throw makeError({ status: 422, message: 'targetUserId or targetEmail is required' });
  }

  if (targetModel === InquiryResourceModel.Organization) {
    if (body.targetOrganizationId) {
      const org = await db.organization.findUnique({
        where: { id: body.targetOrganizationId },
      });
      if (!org) throw makeError({ status: 404, message: 'Target organization not found' });
      return { ...nullTargetFields, targetModel, targetOrganizationId: org.id };
    }
    if (body.targetOrganizationSlug) {
      const org = await db.organization.findUnique({
        where: { slug: body.targetOrganizationSlug as string },
      });
      if (!org) throw makeError({ status: 404, message: 'Target organization not found' });
      return { ...nullTargetFields, targetModel, targetOrganizationId: org.id };
    }
    throw makeError({
      status: 422,
      message: 'targetOrganizationId or targetOrganizationSlug is required',
    });
  }

  if (targetModel === InquiryResourceModel.Space) {
    if (body.targetSpaceId) {
      const space = await db.space.findUnique({ where: { id: body.targetSpaceId } });
      if (!space) throw makeError({ status: 404, message: 'Target space not found' });
      return { ...nullTargetFields, targetModel, targetSpaceId: space.id };
    }
    if (body.targetOrganizationSlug && body.targetSpaceSlug) {
      const space = await db.space.findFirst({
        where: {
          slug: body.targetSpaceSlug as string,
          organization: { slug: body.targetOrganizationSlug as string },
        },
      });
      if (!space) throw makeError({ status: 404, message: 'Target space not found' });
      return { ...nullTargetFields, targetModel, targetSpaceId: space.id };
    }
    throw makeError({
      status: 422,
      message: 'targetSpaceId or targetOrganizationSlug + targetSpaceSlug is required',
    });
  }

  if (targetModel === InquiryResourceModel.OrganizationUser) {
    if (!body.targetOrganizationId || !body.targetUserId)
      throw makeError({
        status: 422,
        message: 'targetOrganizationId and targetUserId are required',
      });
    const organizationUser = await db.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: body.targetOrganizationId,
          userId: body.targetUserId,
        },
      },
    });
    if (!organizationUser)
      throw makeError({ status: 404, message: 'Target organization user not found' });
    return {
      ...nullTargetFields,
      targetModel,
      targetOrganizationId: organizationUser.organizationId,
      targetUserId: organizationUser.userId,
    };
  }

  if (targetModel === InquiryResourceModel.SpaceUser) {
    if (!body.targetSpaceId || !body.targetUserId)
      throw makeError({ status: 422, message: 'targetSpaceId and targetUserId are required' });
    const spaceUser = await db.spaceUser.findFirst({
      where: { spaceId: body.targetSpaceId, userId: body.targetUserId },
    });
    if (!spaceUser) throw makeError({ status: 404, message: 'Target space user not found' });
    return {
      ...nullTargetFields,
      targetModel,
      targetOrganizationId: spaceUser.organizationId,
      targetSpaceId: spaceUser.spaceId,
      targetUserId: spaceUser.userId,
    };
  }

  // Integration and Token name a row no request body can resolve: they are set by the
  // service that already holds the party, never from a slug or an email.
  if (targetModel !== InquiryResourceModel.admin)
    throw makeError({
      status: 422,
      message: `Inquiry target ${targetModel} cannot be resolved from a request`,
    });
  return { ...nullTargetFields, targetModel };
};
