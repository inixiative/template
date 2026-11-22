/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { BillingAccount, BillingResource } from '@template/db/generated/client/client';
import {
  BillingAccountOwnerModel,
  BillingResourceTargetModel,
} from '@template/db/generated/client/enums';
import {
  type BillingOwnerRef,
  isBillingOwnerAllowed,
} from '#/modules/billingAccount/services/billingGovernance';
import { ownerWhereForBillingAccount } from '#/modules/billingAccount/services/createBillingAccount';

export type BillingResolveTarget =
  | { targetModel: 'User'; id: string }
  | { targetModel: 'Organization'; id: string }
  | { targetModel: 'Space'; id: string }
  | { targetModel: 'OrganizationUser'; id: string }
  | { targetModel: 'SpaceUser'; id: string }
  | { targetModel: 'Project'; id: string }
  | { targetModel: 'ProjectIntegration'; id: string };

export type ResolvedBillingAccount = {
  billingAccount: BillingAccount;
  billingResource: BillingResource | null;
  source: 'binding' | 'ownerDefault';
  boundAt: string;
};

type WalkNode =
  | { kind: 'resource'; resourceModel: BillingResourceTargetModel; where: Record<string, string> }
  | { kind: 'owner'; owner: BillingOwnerRef };

const buildOwnerChain = (owner: BillingOwnerRef): WalkNode[] => {
  switch (owner.ownerModel) {
    case BillingAccountOwnerModel.User:
      return [{ kind: 'owner', owner }];

    case BillingAccountOwnerModel.Organization:
      return [{ kind: 'owner', owner }];

    case BillingAccountOwnerModel.Space:
      return [
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.Space,
          where: {
            resourceModel: BillingResourceTargetModel.Space,
            resourceOrganizationId: owner.organizationId!,
            resourceSpaceId: owner.spaceId!,
          },
        },
        { kind: 'owner', owner },
        {
          kind: 'owner',
          owner: {
            ownerModel: BillingAccountOwnerModel.Organization,
            organizationId: owner.organizationId!,
          },
        },
      ];

    case BillingAccountOwnerModel.OrganizationUser:
      return [
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.OrganizationUser,
          where: {
            resourceModel: BillingResourceTargetModel.OrganizationUser,
            resourceOrganizationId: owner.organizationId!,
            resourceUserId: owner.userId!,
          },
        },
        { kind: 'owner', owner },
        {
          kind: 'owner',
          owner: {
            ownerModel: BillingAccountOwnerModel.Organization,
            organizationId: owner.organizationId!,
          },
        },
      ];

    case BillingAccountOwnerModel.SpaceUser:
      return [
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.SpaceUser,
          where: {
            resourceModel: BillingResourceTargetModel.SpaceUser,
            resourceOrganizationId: owner.organizationId!,
            resourceSpaceId: owner.spaceId!,
            resourceUserId: owner.userId!,
          },
        },
        { kind: 'owner', owner },
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.OrganizationUser,
          where: {
            resourceModel: BillingResourceTargetModel.OrganizationUser,
            resourceOrganizationId: owner.organizationId!,
            resourceUserId: owner.userId!,
          },
        },
        {
          kind: 'owner',
          owner: {
            ownerModel: BillingAccountOwnerModel.OrganizationUser,
            organizationId: owner.organizationId!,
            userId: owner.userId!,
          },
        },
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.Space,
          where: {
            resourceModel: BillingResourceTargetModel.Space,
            resourceOrganizationId: owner.organizationId!,
            resourceSpaceId: owner.spaceId!,
          },
        },
        {
          kind: 'owner',
          owner: {
            ownerModel: BillingAccountOwnerModel.Space,
            organizationId: owner.organizationId!,
            spaceId: owner.spaceId!,
          },
        },
        {
          kind: 'owner',
          owner: {
            ownerModel: BillingAccountOwnerModel.Organization,
            organizationId: owner.organizationId!,
          },
        },
      ];
  }
};

const buildWalkChain = async (target: BillingResolveTarget): Promise<WalkNode[] | null> => {
  switch (target.targetModel) {
    case 'User': {
      const user = await db.user.findFirst({
        where: { id: target.id, deletedAt: null },
        select: { id: true },
      });
      return user
        ? buildOwnerChain({ ownerModel: BillingAccountOwnerModel.User, userId: user.id })
        : null;
    }

    case 'Organization': {
      const org = await db.organization.findFirst({
        where: { id: target.id, deletedAt: null },
        select: { id: true },
      });
      return org
        ? buildOwnerChain({
            ownerModel: BillingAccountOwnerModel.Organization,
            organizationId: org.id,
          })
        : null;
    }

    case 'Space': {
      const space = await db.space.findFirst({
        where: { id: target.id, deletedAt: null },
        select: { id: true, organizationId: true },
      });
      return space
        ? buildOwnerChain({
            ownerModel: BillingAccountOwnerModel.Space,
            organizationId: space.organizationId,
            spaceId: space.id,
          })
        : null;
    }

    case 'OrganizationUser': {
      const member = await db.organizationUser.findFirst({
        where: { id: target.id, deletedAt: null },
        select: { organizationId: true, userId: true },
      });
      return member
        ? buildOwnerChain({
            ownerModel: BillingAccountOwnerModel.OrganizationUser,
            organizationId: member.organizationId,
            userId: member.userId,
          })
        : null;
    }

    case 'SpaceUser': {
      const member = await db.spaceUser.findFirst({
        where: { id: target.id, deletedAt: null },
        select: { organizationId: true, spaceId: true, userId: true },
      });
      return member
        ? buildOwnerChain({
            ownerModel: BillingAccountOwnerModel.SpaceUser,
            organizationId: member.organizationId,
            spaceId: member.spaceId,
            userId: member.userId,
          })
        : null;
    }

    case 'Project': {
      const project = await db.project.findFirst({
        where: { id: target.id, deletedAt: null },
        select: { id: true, ownerModel: true, userId: true, organizationId: true, spaceId: true },
      });
      if (!project) return null;
      return [
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.Project,
          where: {
            resourceModel: BillingResourceTargetModel.Project,
            resourceProjectId: project.id,
          },
        },
        ...buildOwnerChain({
          ownerModel: project.ownerModel as unknown as BillingAccountOwnerModel,
          userId: project.userId,
          organizationId: project.organizationId,
          spaceId: project.spaceId,
        }),
      ];
    }

    case 'ProjectIntegration': {
      const pi = await db.projectIntegration.findFirst({
        where: { id: target.id, deletedAt: null },
        select: {
          id: true,
          project: {
            select: {
              id: true,
              ownerModel: true,
              userId: true,
              organizationId: true,
              spaceId: true,
              deletedAt: true,
            },
          },
        },
      });
      if (!pi || pi.project.deletedAt) return null;
      return [
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.ProjectIntegration,
          where: {
            resourceModel: BillingResourceTargetModel.ProjectIntegration,
            resourceProjectIntegrationId: pi.id,
          },
        },
        {
          kind: 'resource',
          resourceModel: BillingResourceTargetModel.Project,
          where: {
            resourceModel: BillingResourceTargetModel.Project,
            resourceProjectId: pi.project.id,
          },
        },
        ...buildOwnerChain({
          ownerModel: pi.project.ownerModel as unknown as BillingAccountOwnerModel,
          userId: pi.project.userId,
          organizationId: pi.project.organizationId,
          spaceId: pi.project.spaceId,
        }),
      ];
    }
  }
};

export const resolveBillingAccount = async (
  target: BillingResolveTarget,
): Promise<ResolvedBillingAccount | null> => {
  const chain = await buildWalkChain(target);
  if (!chain) return null;

  for (const node of chain) {
    if (node.kind === 'resource') {
      const binding = await db.billingResource.findFirst({
        where: { ...node.where, deletedAt: null },
        include: { billingAccount: true },
      });
      if (binding && !binding.billingAccount.deletedAt) {
        const allowed = await isBillingOwnerAllowed(binding.billingAccount);
        if (allowed) {
          return {
            billingAccount: binding.billingAccount,
            billingResource: binding,
            source: 'binding',
            boundAt: node.resourceModel,
          };
        }
      }
      continue;
    }

    const allowed = await isBillingOwnerAllowed(node.owner);
    if (!allowed) continue;

    const account = await db.billingAccount.findFirst({
      where: {
        ...ownerWhereForBillingAccount(node.owner),
        isDefault: true,
        deletedAt: null,
      },
    });
    if (account) {
      return {
        billingAccount: account,
        billingResource: null,
        source: 'ownerDefault',
        boundAt: node.owner.ownerModel,
      };
    }
  }

  return null;
};
