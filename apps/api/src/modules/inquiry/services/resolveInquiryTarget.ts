/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma, feature:tenancy, feature:users
 */
import { emptySideKeyColumns, polymorphicAxis } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { type ValidatedContext, validatedBody } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';

const nullTargetFields = emptySideKeyColumns(polymorphicAxis('Inquiry', 'targetModel'));
export type InquiryTargetBody = {
  targetModel: InquiryResourceModel;
  targetUserId?: string;
  targetOrganizationId?: string;
  targetSpaceId?: string;
  targetTokenId?: string | null;
  targetIntegrationId?: string | null;
  targetEmail?: string;
  targetOrganizationSlug?: string;
  targetSpaceSlug?: string;
};

export type InquiryTargetFields =
  | { targetModel: (typeof InquiryResourceModel)['User']; targetUserId: string | null }
  | {
      targetModel: (typeof InquiryResourceModel)['Organization'];
      targetOrganizationId: string;
    }
  | {
      targetModel: (typeof InquiryResourceModel)['Space'];
      targetOrganizationId: string;
      targetSpaceId: string;
    }
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
  | { targetModel: (typeof InquiryResourceModel)['Token']; targetTokenId: string }
  | { targetModel: (typeof InquiryResourceModel)['Integration']; targetIntegrationId: string }
  | { targetModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquiryTarget = async <C extends ValidatedContext<'json', InquiryTargetBody>>(
  c: C,
  options: { allowCreateGuest?: boolean } = {},
): Promise<InquiryTargetFields> => {
  const { allowCreateGuest = true } = options;
  const db = c.get('db');
  const body = validatedBody(c);
  const targetModel: InquiryResourceModel = body.targetModel;

  if (targetModel === InquiryResourceModel.User) {
    if (body.targetUserId) {
      const user = await db.user.findUnique({ where: { id: body.targetUserId } });
      if (!user) throw makeError({ status: 404, message: 'Target user not found' });
      return { ...nullTargetFields, targetModel, targetUserId: user.id };
    }
    if (body.targetEmail) {
      if (!allowCreateGuest) {
        const existing = await db.user.findUnique({
          where: { email: normalizeEmail(body.targetEmail as string) },
          select: { id: true },
        });
        return { ...nullTargetFields, targetModel, targetUserId: existing?.id ?? null };
      }
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
      return {
        ...nullTargetFields,
        targetModel,
        targetOrganizationId: space.organizationId,
        targetSpaceId: space.id,
      };
    }
    if (body.targetOrganizationSlug && body.targetSpaceSlug) {
      const space = await db.space.findFirst({
        where: {
          slug: body.targetSpaceSlug as string,
          organization: { slug: body.targetOrganizationSlug as string },
        },
      });
      if (!space) throw makeError({ status: 404, message: 'Target space not found' });
      return {
        ...nullTargetFields,
        targetModel,
        targetOrganizationId: space.organizationId,
        targetSpaceId: space.id,
      };
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

  if (targetModel === InquiryResourceModel.Token) {
    const token = body.targetTokenId
      ? await db.token.findUnique({ where: { id: body.targetTokenId } })
      : null;
    if (!token) throw makeError({ status: 404, message: 'Target token not found' });
    return { ...nullTargetFields, targetModel, targetTokenId: token.id };
  }

  if (targetModel === InquiryResourceModel.Integration) {
    const integration = body.targetIntegrationId
      ? await db.integration.findUnique({ where: { id: body.targetIntegrationId } })
      : null;
    if (!integration) throw makeError({ status: 404, message: 'Target integration not found' });
    return { ...nullTargetFields, targetModel, targetIntegrationId: integration.id };
  }

  // why: a Project is named only by the service that holds the party
  if (targetModel !== InquiryResourceModel.admin)
    throw makeError({
      status: 422,
      message: `Inquiry target ${targetModel} cannot be resolved from a request`,
    });
  return { ...nullTargetFields, targetModel };
};
