/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry, primitive:authz
 * @uses infrastructure:prisma
 */
import { type Db, type HydratedRecord, hydrate, type Prisma, type UserId } from '@template/db';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import { type Entitlements, SessionAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { z } from 'zod';
import { makeError } from '#/lib/errors';
import { assignLevel } from '#/lib/permissions/assignLevel';
import { findActionsUserLacks } from '#/lib/permissions/findActionsUserLacks';
import { findUnheldGrant } from '#/lib/permissions/findUnheldGrant';
import { autoApproveOwnRequest } from '#/modules/inquiry/handlers/autoApproveOwnRequest';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { findUserWithRelations } from '#/modules/user/services/find';

export const entitlementGrantSchema = z.object({
  role: z.nativeEnum(Role),
  entitlements: z.record(z.string(), z.boolean()).nullable(),
  entitlementsOnly: z.boolean(),
});

const contentSchema = entitlementGrantSchema.extend({
  purpose: z.string().min(1).max(500),
  role: z.nativeEnum(Role).default(Role.viewer),
  entitlements: z.record(z.string(), z.boolean()).nullable().default(null),
  entitlementsOnly: z.boolean().default(false),
});

const resolutionSchema = baseResolutionInputSchema.extend({
  grant: entitlementGrantSchema.optional(),
});

type GrantUserEntitlementsContent = z.infer<typeof contentSchema>;
type GrantUserEntitlementsResolution = z.infer<typeof resolutionSchema>;

const findMembership = (db: Db, inquiry: Partial<Inquiry>) => {
  if (inquiry.targetModel === InquiryResourceModel.Organization)
    return db.organizationUser.findFirst({
      where: { organizationId: inquiry.targetOrganizationId!, userId: inquiry.sourceUserId! },
    });
  return db.spaceUser.findFirst({
    where: { spaceId: inquiry.targetSpaceId!, userId: inquiry.sourceUserId! },
  });
};

const writeMembershipEntitlements = async (
  db: Db,
  inquiry: Inquiry,
  update: (current: Entitlements) => Entitlements,
) => {
  const membership = await findMembership(db, inquiry);
  if (!membership) throw makeError({ status: 422, message: 'The requester is not a member' });
  const entitlements = update(membership.entitlements as Entitlements) as Prisma.InputJsonValue;
  if (inquiry.targetModel === InquiryResourceModel.Organization)
    await db.organizationUser.update({ where: { id: membership.id }, data: { entitlements } });
  else await db.spaceUser.update({ where: { id: membership.id }, data: { entitlements } });
};

const isMembershipTarget = (inquiry: Partial<Inquiry>) =>
  inquiry.targetModel === InquiryResourceModel.Organization ||
  inquiry.targetModel === InquiryResourceModel.Space;

const validate = async (
  db: Db,
  inquiry: Partial<Inquiry>,
  content: GrantUserEntitlementsContent,
): Promise<void> => {
  if (isMembershipTarget(inquiry)) {
    if (inquiry.sourceModel !== InquiryResourceModel.User)
      throw makeError({ status: 422, message: 'Only a member can ask its organization or space' });
    if (!Object.values(content.entitlements ?? {}).some(Boolean))
      throw makeError({ status: 422, message: 'Name the entitlements to grant' });
    if (!(await findMembership(db, inquiry)))
      throw makeError({ status: 422, message: 'The requester is not a member' });
    return;
  }

  if (
    inquiry.sourceModel === InquiryResourceModel.User &&
    inquiry.sourceUserId !== inquiry.targetUserId
  )
    throw makeError({ status: 422, message: 'A user can only grant their own entitlements' });

  const targetUser = await findUserWithRelations(db, inquiry.targetUserId as UserId);
  if (!targetUser) throw makeError({ status: 404, message: 'Target user not found' });
  const lacking = findActionsUserLacks(targetUser, content.entitlements);
  if (lacking.length)
    throw makeError({
      status: 422,
      message: `The user does not hold these actions: ${lacking.join(', ')}`,
    });
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
    if (inquiry.targetModel === InquiryResourceModel.Organization)
      return check(
        permix,
        rebacSchema,
        'organization',
        { id: inquiry.targetOrganizationId!, role: assignLevel(null, content.entitlements) },
        'assign',
      );
    if (inquiry.targetModel === InquiryResourceModel.Space) {
      const space = await hydrate('space', { id: inquiry.targetSpaceId! } as HydratedRecord);
      return check(
        permix,
        rebacSchema,
        'space',
        { ...space, role: assignLevel(null, content.entitlements) },
        'assign',
      );
    }
    const user = c.get('user');
    return (
      !!user &&
      check(permix, rebacSchema, 'user', user, SessionAction.createToken) &&
      !(await findUnheldGrant(c, content)).length
    );
  },

  handleApprove: async (db, inquiry, content) => {
    await validate(db, inquiry, content);
    if (isMembershipTarget(inquiry)) {
      await writeMembershipEntitlements(db, inquiry, (current) => ({
        ...current,
        ...content.entitlements,
      }));
      return;
    }
    const { role, entitlements, entitlementsOnly } = content;
    return { grant: { role, entitlements, entitlementsOnly } };
  },

  handleRevoke: async (db, inquiry, content) => {
    if (!isMembershipTarget(inquiry)) return;
    const granted = new Set(Object.keys(content.entitlements ?? {}));
    await writeMembershipEntitlements(db, inquiry, (current) =>
      Object.fromEntries(Object.entries(current ?? {}).filter(([action]) => !granted.has(action))),
    );
  },
};
