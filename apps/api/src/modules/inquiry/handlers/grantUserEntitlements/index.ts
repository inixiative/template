/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry, primitive:authz
 * @uses infrastructure:prisma
 */

import { db, type HydratedRecord, hydrate, Prisma } from '@template/db';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import {
  type BindRoots,
  createInterpolator,
  type Entitlements,
  isFlatEntitlements,
  normalizeEntitlements,
  SessionAction,
} from '@template/permissions';
import { canAssign } from '@template/permissions/assign';
import { entitlementsSchema } from '@template/permissions/entitlementsSchema';
import { check, rebacSchema } from '@template/permissions/rebac';
import { z } from 'zod';
import { makeError } from '#/lib/errors';
import { interpolateOr422 } from '#/lib/permissions/interpolateOr422';
import { validateEntitlementsWithin } from '#/lib/permissions/validateEntitlementsWithin';
import { autoApproveOwnRequest } from '#/modules/inquiry/handlers/autoApproveOwnRequest';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';

const membershipEntitlementsSchema = z.record(z.string(), z.boolean()).nullable();

const inquiryGrant = createInterpolator(['source', 'target', 'content']);

export const grantSchema = z.object({
  role: z.nativeEnum(Role),
  entitlements: entitlementsSchema,
});

const contentSchema = z.object({
  purpose: z.string().min(1).max(500),
  role: z.nativeEnum(Role).default(Role.viewer),
  entitlements: z.union([entitlementsSchema, membershipEntitlementsSchema]).default(null),
});

const resolutionInputSchema = baseResolutionInputSchema.extend({
  entitlements: entitlementsSchema.optional(),
});

const resolutionSchema = resolutionInputSchema.extend({
  grant: grantSchema.optional(),
  addedEntitlements: z.array(z.string()).optional(),
});

type GrantUserEntitlementsContent = z.infer<typeof contentSchema>;
type GrantUserEntitlementsResolution = z.infer<typeof resolutionSchema>;
type GrantUserEntitlementsResolutionInput = z.infer<typeof resolutionInputSchema>;

const findMembership = (inquiry: Partial<Inquiry>) => {
  if (inquiry.targetModel === InquiryResourceModel.Organization)
    return db.organizationUser.findFirst({
      where: { organizationId: inquiry.targetOrganizationId!, userId: inquiry.sourceUserId! },
    });
  return db.spaceUser.findFirst({
    where: { spaceId: inquiry.targetSpaceId!, userId: inquiry.sourceUserId! },
  });
};

const ownerKeyOf = (inquiry: Inquiry) =>
  inquiry.targetModel === InquiryResourceModel.Organization
    ? `db:organization:${inquiry.targetOrganizationId}`
    : `db:space:${inquiry.targetSpaceId}`;

const writeMembershipEntitlements = async (
  inquiry: Inquiry,
  update: (current: Record<string, boolean> | null) => Record<string, boolean>,
) => {
  const membership = await findMembership(inquiry);
  if (!membership) throw makeError({ status: 422, message: 'The requester is not a member' });
  const ownerKey = ownerKeyOf(inquiry);
  const keyed = normalizeEntitlements(membership.entitlements, ownerKey) ?? {};
  const owned = Object.fromEntries(
    Object.entries(keyed[ownerKey] ?? {}).filter(([, value]) => value === true),
  ) as Record<string, boolean>;
  const next = update(Object.keys(owned).length ? owned : null);
  const ownerActions = Object.fromEntries(
    Object.entries(next)
      .filter(([, held]) => held)
      .map(([action]) => [action, true as const]),
  );
  const entitlements = {
    ...keyed,
    ...(Object.keys(ownerActions).length ? { [ownerKey]: ownerActions } : {}),
  };
  if (!Object.keys(ownerActions).length) delete entitlements[ownerKey];
  const data = {
    entitlements: Object.keys(entitlements).length
      ? (entitlements as Prisma.InputJsonValue)
      : Prisma.DbNull,
  };
  if (inquiry.targetModel === InquiryResourceModel.Organization)
    await db.organizationUser.update({ where: { id: membership.id }, data });
  else await db.spaceUser.update({ where: { id: membership.id }, data });
};

const isMembershipTarget = (inquiry: Partial<Inquiry>) =>
  inquiry.targetModel === InquiryResourceModel.Organization ||
  inquiry.targetModel === InquiryResourceModel.Space;

const membershipEntitlements = (content: GrantUserEntitlementsContent) =>
  isFlatEntitlements(content.entitlements) ? content.entitlements : null;

const bindRoots = async (
  inquiry: Partial<Inquiry>,
  content: GrantUserEntitlementsContent,
): Promise<BindRoots> => {
  const source = inquiry.sourceIntegrationId
    ? await db.integration.findUniqueOrThrow({ where: { id: inquiry.sourceIntegrationId } })
    : await db.user.findUniqueOrThrow({ where: { id: inquiry.sourceUserId! } });
  const target = await db.user.findUniqueOrThrow({ where: { id: inquiry.targetUserId! } });
  return { source, target, content };
};

const bindGrant = async (
  inquiry: Partial<Inquiry>,
  content: GrantUserEntitlementsContent,
  entitlements: Entitlements,
) => interpolateOr422(inquiryGrant, entitlements, await bindRoots(inquiry, content));

const validate = async (
  inquiry: Partial<Inquiry>,
  content: GrantUserEntitlementsContent,
): Promise<void> => {
  if (isMembershipTarget(inquiry)) {
    if (inquiry.sourceModel !== InquiryResourceModel.User)
      throw makeError({ status: 422, message: 'Only a member can ask its organization or space' });
    if (!Object.values(membershipEntitlements(content) ?? {}).some(Boolean))
      throw makeError({ status: 422, message: 'Name the entitlements to grant' });
    if (!(await findMembership(inquiry)))
      throw makeError({ status: 422, message: 'The requester is not a member' });
    return;
  }

  if (
    inquiry.sourceModel === InquiryResourceModel.User &&
    inquiry.sourceUserId !== inquiry.targetUserId
  )
    throw makeError({ status: 422, message: 'A user can only grant their own entitlements' });
  if (isFlatEntitlements(content.entitlements))
    throw makeError({
      status: 422,
      message: 'A grant to a user keys its entitlements by resource',
    });
  if (content.entitlements && !Object.keys(content.entitlements).length)
    throw makeError({
      status: 422,
      message: 'Name at least one grant key, or null for everything',
    });
  if (!(await db.user.findUnique({ where: { id: inquiry.targetUserId! } })))
    throw makeError({ status: 404, message: 'Target user not found' });
  await bindGrant(inquiry, content, content.entitlements);
};

export const grantUserEntitlementsHandler: InquiryHandler<
  GrantUserEntitlementsContent,
  GrantUserEntitlementsResolution,
  GrantUserEntitlementsResolutionInput
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
  resolutionInputSchema,
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
      return canAssign(permix, owner, owner, null, membershipEntitlements(content));
    }
    if (inquiry.targetModel === InquiryResourceModel.Space) {
      const space = await hydrate('space', { id: inquiry.targetSpaceId! } as HydratedRecord);
      const owner = { model: 'space' as const, record: space };
      return canAssign(permix, owner, owner, null, membershipEntitlements(content));
    }
    const user = c.get('user');
    return !!user && check(permix, rebacSchema, 'user', user, SessionAction.createToken);
  },

  handleApprove: async (inquiry, content) => {
    await validate(inquiry, content);
    if (isMembershipTarget(inquiry)) {
      const granted = membershipEntitlements(content) ?? {};
      let addedEntitlements: string[] = [];
      await writeMembershipEntitlements(inquiry, (current) => {
        addedEntitlements = Object.keys(granted).filter(
          (action) => granted[action] === true && current?.[action] !== true,
        );
        return { ...current, ...granted };
      });
      return { addedEntitlements };
    }
    const asked = contentSchema.parse(inquiry.content).entitlements as Entitlements;
    const entitlements = content.entitlements as Entitlements;
    validateEntitlementsWithin(entitlements, asked);
    return {
      grant: { role: content.role, entitlements: await bindGrant(inquiry, content, entitlements) },
    };
  },

  handleRevoke: async (inquiry) => {
    if (!isMembershipTarget(inquiry)) return;
    const granted = new Set(resolutionSchema.parse(inquiry.resolution).addedEntitlements ?? []);
    await writeMembershipEntitlements(inquiry, (current) =>
      Object.fromEntries(Object.entries(current ?? {}).filter(([action]) => !granted.has(action))),
    );
  },
};
