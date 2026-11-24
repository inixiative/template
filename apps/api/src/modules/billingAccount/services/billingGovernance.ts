/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import {
  BillingAccountOwnerModel,
  BillingAccountSharing,
  SettingResourceModel,
} from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';

export type BillingOwnerRef = {
  ownerModel: BillingAccountOwnerModel;
  userId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
};

const fetchBooleanSetting = async (where: {
  resourceModel: SettingResourceModel;
  resourceOrganizationId?: string;
  resourceSpaceId?: string;
  resourceUserId?: string;
  key: string;
}): Promise<boolean> => {
  const row = await db.setting.findFirst({
    where: {
      ...where,
      disabled: false,
      deletedAt: null,
    },
    select: { valueBoolean: true },
  });
  return row?.valueBoolean === true;
};

export const isBillingOwnerAllowed = async (owner: BillingOwnerRef): Promise<boolean> => {
  switch (owner.ownerModel) {
    case BillingAccountOwnerModel.User:
    case BillingAccountOwnerModel.Organization:
      return true;

    case BillingAccountOwnerModel.Space: {
      if (!owner.organizationId) return false;
      return fetchBooleanSetting({
        resourceModel: SettingResourceModel.Organization,
        resourceOrganizationId: owner.organizationId,
        key: 'billing.allowSpaceBilling',
      });
    }

    case BillingAccountOwnerModel.OrganizationUser: {
      if (!owner.organizationId) return false;
      return fetchBooleanSetting({
        resourceModel: SettingResourceModel.Organization,
        resourceOrganizationId: owner.organizationId,
        key: 'billing.allowOrgUserBilling',
      });
    }

    case BillingAccountOwnerModel.SpaceUser: {
      if (!owner.organizationId || !owner.spaceId || !owner.userId) return false;
      const [orgAllowsSpace, orgAllowsOrgUser, spaceAllows, orgUserAllows] = await Promise.all([
        fetchBooleanSetting({
          resourceModel: SettingResourceModel.Organization,
          resourceOrganizationId: owner.organizationId,
          key: 'billing.allowSpaceBilling',
        }),
        fetchBooleanSetting({
          resourceModel: SettingResourceModel.Organization,
          resourceOrganizationId: owner.organizationId,
          key: 'billing.allowOrgUserBilling',
        }),
        fetchBooleanSetting({
          resourceModel: SettingResourceModel.Space,
          resourceOrganizationId: owner.organizationId,
          resourceSpaceId: owner.spaceId,
          key: 'billing.allowSpaceUserBilling',
        }),
        fetchBooleanSetting({
          resourceModel: SettingResourceModel.OrganizationUser,
          resourceOrganizationId: owner.organizationId,
          resourceUserId: owner.userId,
          key: 'billing.allowSpaceUserBilling',
        }),
      ]);
      return (orgAllowsSpace || orgAllowsOrgUser) && spaceAllows && orgUserAllows;
    }
  }
};

export const assertBillingOwnerAllowed = async (owner: BillingOwnerRef): Promise<void> => {
  if (!(await isBillingOwnerAllowed(owner))) {
    throw makeError({
      status: 403,
      message: `${owner.ownerModel} billing is not enabled by parent settings`,
    });
  }
};

export const fetchOwnerShareDefault = async (owner: BillingOwnerRef): Promise<boolean> => {
  if (owner.ownerModel === BillingAccountOwnerModel.Organization && owner.organizationId) {
    return fetchBooleanSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceOrganizationId: owner.organizationId,
      key: 'billing.shareAccountsWithMembers',
    });
  }
  if (
    owner.ownerModel === BillingAccountOwnerModel.Space &&
    owner.organizationId &&
    owner.spaceId
  ) {
    return fetchBooleanSetting({
      resourceModel: SettingResourceModel.Space,
      resourceOrganizationId: owner.organizationId,
      resourceSpaceId: owner.spaceId,
      key: 'billing.shareAccountsWithMembers',
    });
  }
  return false;
};

export const computeEffectiveIsShared = async (
  sharing: BillingAccountSharing,
  owner: BillingOwnerRef,
): Promise<boolean> => {
  if (
    owner.ownerModel !== BillingAccountOwnerModel.Organization &&
    owner.ownerModel !== BillingAccountOwnerModel.Space
  ) {
    return false;
  }
  if (sharing === BillingAccountSharing.on) return true;
  if (sharing === BillingAccountSharing.off) return false;
  return fetchOwnerShareDefault(owner);
};

export const ownerLockKeyForBillingAccount = (
  owner: BillingOwnerRef,
): {
  ownerModel: string;
  ownerId: string;
} => {
  switch (owner.ownerModel) {
    case BillingAccountOwnerModel.User:
      return { ownerModel: 'User', ownerId: owner.userId ?? '' };
    case BillingAccountOwnerModel.Organization:
      return { ownerModel: 'Organization', ownerId: owner.organizationId ?? '' };
    case BillingAccountOwnerModel.OrganizationUser:
      return {
        ownerModel: 'OrganizationUser',
        ownerId: `${owner.organizationId ?? ''}:${owner.userId ?? ''}`,
      };
    case BillingAccountOwnerModel.Space:
      return {
        ownerModel: 'Space',
        ownerId: `${owner.organizationId ?? ''}:${owner.spaceId ?? ''}`,
      };
    case BillingAccountOwnerModel.SpaceUser:
      return {
        ownerModel: 'SpaceUser',
        ownerId: `${owner.organizationId ?? ''}:${owner.spaceId ?? ''}:${owner.userId ?? ''}`,
      };
  }
};
