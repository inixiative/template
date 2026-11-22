/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */

import type { EmailOwnerModel } from '@template/db/generated/client/client';
import {
  BIND_NAME_BY_OWNER_MODEL,
  type BindableOwnerModel,
  ownerKindsTheArmIdentifies,
  polymorphicKeyColumns,
} from '@template/db/registries/polymorphicAxisPointsAt';
import {
  type OwnerKeys,
  wherePolymorphicSideIsOneOf,
} from '@template/db/registries/wherePolymorphicSideIsOneOf';
import type { OwnerScope } from '@template/email/render/types';
import type { EmailLensOwner } from '@template/email/rules/scopeEmailLens';

export const parentOwner = (owner: EmailOwnerModel): EmailOwnerModel | null => {
  switch (owner) {
    case 'SpaceUser':
      return 'OrganizationUser';
    case 'OrganizationUser':
      return 'User';
    case 'User':
      return 'default';
    case 'Space':
      return 'Organization';
    case 'Organization':
    case 'admin':
      return 'default';
    default:
      return null;
  }
};

export const ownerCascade = (owner: EmailOwnerModel): EmailOwnerModel[] => {
  const chain: EmailOwnerModel[] = [owner];
  for (let parent = parentOwner(owner); parent; parent = parentOwner(parent)) chain.push(parent);
  return chain;
};

type EmailOwnedModel = 'EmailTemplate' | 'EmailComponent';

const tierOwnerKeys = (
  model: EmailOwnedModel,
  ctx: OwnerScope,
  tier: EmailOwnerModel,
): OwnerKeys => {
  const identified = ownerKindsTheArmIdentifies(model, 'ownerModel', tier).map(({ kind }) => kind);
  const carried = polymorphicKeyColumns(model, 'ownerModel', tier);
  return Object.fromEntries(
    (Object.keys(BIND_NAME_BY_OWNER_MODEL) as BindableOwnerModel[]).flatMap((kind) => {
      const bindName = BIND_NAME_BY_OWNER_MODEL[kind];
      if (identified.includes(kind)) return [[kind, ctx[bindName] ?? null]];
      return carried.includes(bindName) ? [] : [[kind, null]];
    }),
  );
};

export const ownerWhere = (
  model: EmailOwnedModel,
  ctx: OwnerScope,
  tier: EmailOwnerModel = ctx.ownerModel,
) => ({
  locale: ctx.locale,
  deletedAt: null,
  ownerModel: tier,
  ...wherePolymorphicSideIsOneOf(model, 'ownerModel', [
    { ownerKeys: tierOwnerKeys(model, ctx, tier) },
  ]),
  ...(tier === 'Organization' && ctx.ownerModel === 'Space' && { inheritToSpaces: true }),
});

export const fetchersPerOwnerTier = <T>(
  ctx: OwnerScope,
  build: (tier: EmailOwnerModel) => Promise<T>,
): (() => Promise<T>)[] => ownerCascade(ctx.ownerModel).map((tier) => () => build(tier));

export const fetchFirstNonEmptyResult = async <T>(
  lookups: (() => Promise<T | null | undefined>)[],
): Promise<T | null> => {
  for (const lookup of lookups) {
    const result = await lookup();
    if (result) return result;
  }
  return null;
};

export type EmailOwnerRef = Pick<
  OwnerScope,
  'ownerModel' | 'organizationId' | 'spaceId' | 'userId'
>;

export const ownerScopeOfRow = (row: EmailOwnerRef & { locale: string }): OwnerScope => ({
  ownerModel: row.ownerModel,
  organizationId: row.organizationId,
  spaceId: row.spaceId,
  userId: row.userId,
  locale: row.locale,
});

export const emailLensOwnerOf = (owner: EmailOwnerRef): EmailLensOwner => {
  switch (owner.ownerModel) {
    case 'Organization':
      return owner.organizationId
        ? { ownerModel: 'Organization', ownerId: owner.organizationId }
        : null;
    case 'Space':
      return owner.spaceId
        ? { ownerModel: 'Space', ownerId: owner.spaceId, organizationId: owner.organizationId }
        : null;
    case 'User':
    case 'OrganizationUser':
    case 'SpaceUser':
      return owner.userId ? { ownerModel: 'User', ownerId: owner.userId } : null;
    default:
      return null;
  }
};
