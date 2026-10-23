/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry, primitive:authz
 * @uses infrastructure:prisma
 */

import { db, type HydratedRecord, hydrate, type Prisma, type UserId } from '@template/db';
import { InquiryResourceModel, IntegrationReach, Role } from '@template/db/generated/client/enums';
import { type Entitlements, SessionAction } from '@template/permissions';
import { canAssign } from '@template/permissions/assign';
import { check, rebacSchema } from '@template/permissions/rebac';
import { z } from 'zod';
import { makeError } from '#/lib/errors';
import { findActionsUserLacks } from '#/lib/permissions/findActionsUserLacks';
import { findUnheldGrant } from '#/lib/permissions/findUnheldGrant';
import { resolveIntegrationReach } from '#/lib/permissions/resolveIntegrationReach';
import { autoApproveOwnRequest } from '#/modules/inquiry/handlers/autoApproveOwnRequest';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { findUserWithRelations } from '#/modules/user/services/find';

export const entitlementGrantSchema = z.object({
  role: z.nativeEnum(Role),
  entitlements: z.record(z.string(), z.boolean()).nullable(),
  entitlementsOnly: z.boolean(),
  integrationReach: z.nativeEnum(IntegrationReach),
  integrationReachIds: z.array(z.string()),
});

const contentSchema = entitlementGrantSchema.extend({
  purpose: z.string().min(1).max(500),
  role: z.nativeEnum(Role).default(Role.viewer),
  entitlements: z.record(z.string(), z.boolean()).nullable().default(null),
  entitlementsOnly: z.boolean().default(false),
  integrationReach: z.nativeEnum(IntegrationReach).optional(),
  integrationReachIds: z.array(z.string()).optional(),
});

const resolutionSchema = baseResolutionInputSchema.extend({
  grant: entitlementGrantSchema.optional(),
  addedEntitlements: z.array(z.string()).optional(),
});

type GrantUserEntitlementsContent = z.infer<typeof contentSchema>;
type GrantUserEntitlementsResolution = z.infer<typeof resolutionSchema>;

const findMembership = (inquiry: Partial<Inquiry>) => {
  if (inquiry.targetModel === InquiryResourceModel.Organization)
    return db.organizationUser.findFirst({
      where: { organizationId: inquiry.targetOrganizationId!, userId: inquiry.sourceUserId! },
    });
  return db.spaceUser.findFirst({
    where: { spaceId: inquiry.targetSpaceId!, userId: inquiry.sourceUserId! },
  });
};

const writeMembershipEntitlements = async (
  inquiry: Inquiry,
  update: (current: Entitlements) => Entitlements,
) => {
  const membership = await findMembership(inquiry);
  if (!membership) throw makeError({ status: 422, message: 'The requester is not a member' });
  const entitlements = update(membership.entitlements as Entitlements) as Prisma.InputJsonValue;
  if (inquiry.targetModel === InquiryResourceModel.Organization)
    await db.organizationUser.update({ where: { id: membership.id }, data: { entitlements } });
  else await db.spaceUser.update({ where: { id: membership.id }, data: { entitlements } });
};

const isMembershipTarget = (inquiry: Partial<Inquiry>) =>
  inquiry.targetModel === InquiryResourceModel.Organization ||
  inquiry.targetModel === InquiryResourceModel.Space;

const resolveGrantReach = (inquiry: Partial<Inquiry>, content: GrantUserEntitlementsContent) =>
  resolveIntegrationReach(content, inquiry.sourceIntegrationId ?? null, {
    ownerModel: 'User',
    userId: inquiry.targetUserId,
  });

const validate = async (
  inquiry: Partial<Inquiry>,
  content: GrantUserEntitlementsContent,
): Promise<void> => {
  if (isMembershipTarget(inquiry)) {
    if (inquiry.sourceModel !== InquiryResourceModel.User)
      throw makeError({ status: 422, message: 'Only a member can ask its organization or space' });
    if (!Object.values(content.entitlements ?? {}).some(Boolean))
      throw makeError({ status: 422, message: 'Name the entitlements to grant' });
    if (!(await findMembership(inquiry)))
      throw makeError({ status: 422, message: 'The requester is not a member' });
    if (content.integrationReach !== undefined || content.integrationReachIds !== undefined)
      throw makeError({ status: 422, message: 'integrationReach applies to a grant to a user' });
    return;
  }

  if (
    inquiry.sourceModel === InquiryResourceModel.User &&
    inquiry.sourceUserId !== inquiry.targetUserId
  )
    throw makeError({ status: 422, message: 'A user can only grant their own entitlements' });

  const targetUser = await findUserWithRelations(inquiry.targetUserId as UserId);
  if (!targetUser) throw makeError({ status: 404, message: 'Target user not found' });
  const lacking = findActionsUserLacks(targetUser, content.entitlements);
  if (lacking.length)
    throw makeError({
      status: 422,
      message: `The user does not hold these actions: ${lacking.join(', ')}`,
    });
  await resolveGrantReach(inquiry, content);
};

export const grantUserEntitlementsHandler: InquiryHandler<
  GrantUserEntitlementsContent,
  GrantUserEntitlementsResolution
> = {
  sources: [
    { sourceModel: InquiryResourceModel.User },
    { sourceModel: InquiryResourceModel.Integration },
  ],
  targets: [
    { targetModel: InquiryResourceModel.User },
    { targetModel: InquiryResourceModel.Organization },
    { targetModel: InquiryResourceModel.Space },
  ],
  contentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema,
  defaultExpirationDays: 7,
  validate,
  autoApprove: autoApproveOwnRequest,
  revocable: true,

  canApprove: async (c, inquiry, content) => {
    const permix = c.get('permix');
    if (inquiry.targetModel === InquiryResourceModel.Organization) {
      const owner = {
        model: 'organization' as const,
        record: { id: inquiry.targetOrganizationId! },
      };
      return canAssign(permix, owner, owner, null, content.entitlements);
    }
    if (inquiry.targetModel === InquiryResourceModel.Space) {
      const space = await hydrate('space', { id: inquiry.targetSpaceId! } as HydratedRecord);
      const owner = { model: 'space' as const, record: space };
      return canAssign(permix, owner, owner, null, content.entitlements);
    }
    const user = c.get('user');
    return (
      !!user &&
      check(permix, rebacSchema, 'user', user, SessionAction.createToken) &&
      !(await findUnheldGrant(c, content)).length
    );
  },

  handleApprove: async (inquiry, content) => {
    await validate(inquiry, content);
    if (isMembershipTarget(inquiry)) {
      let addedEntitlements: string[] = [];
      await writeMembershipEntitlements(inquiry, (current) => {
        addedEntitlements = Object.keys(content.entitlements ?? {}).filter(
          (action) => content.entitlements?.[action] === true && current?.[action] !== true,
        );
        return { ...current, ...content.entitlements };
      });
      return { addedEntitlements };
    }
    const { role, entitlements, entitlementsOnly } = content;
    const reach = await resolveGrantReach(inquiry, content);
    return { grant: { role, entitlements, entitlementsOnly, ...reach } };
  },

  handleRevoke: async (inquiry) => {
    if (!isMembershipTarget(inquiry)) return;
    const granted = new Set(resolutionSchema.parse(inquiry.resolution).addedEntitlements ?? []);
    await writeMembershipEntitlements(inquiry, (current) =>
      Object.fromEntries(Object.entries(current ?? {}).filter(([action]) => !granted.has(action))),
    );
  },
};
