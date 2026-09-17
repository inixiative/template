/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { EmailOwnerModel } from '@template/db/generated/client/client';
import type { OwnerScope } from '@template/email/render/types';

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

const tierKeys = (ctx: OwnerScope, tier: EmailOwnerModel) => {
  switch (tier) {
    case 'Space':
      return { spaceId: ctx.spaceId ?? null };
    case 'Organization':
      return { organizationId: ctx.organizationId ?? null, spaceId: null };
    case 'SpaceUser':
      return { spaceId: ctx.spaceId ?? null, userId: ctx.userId ?? null };
    case 'OrganizationUser':
      return { organizationId: ctx.organizationId ?? null, userId: ctx.userId ?? null, spaceId: null };
    case 'User':
      return { userId: ctx.userId ?? null, organizationId: null, spaceId: null };
    default:
      return { organizationId: null, spaceId: null };
  }
};

export const ownerWhere = (ctx: OwnerScope, tier: EmailOwnerModel = ctx.ownerModel) => ({
  locale: ctx.locale,
  deletedAt: null,
  ownerModel: tier,
  ...tierKeys(ctx, tier),
  ...(tier === 'Organization' && ctx.ownerModel === 'Space' && { inheritToSpaces: true }),
});

export const cascadeLookups = <T>(
  ctx: OwnerScope,
  build: (tier: EmailOwnerModel) => Promise<T>,
): (() => Promise<T>)[] => ownerCascade(ctx.ownerModel).map((tier) => () => build(tier));

export const firstResolved = async <T>(lookups: (() => Promise<T | null | undefined>)[]): Promise<T | null> => {
  for (const lookup of lookups) {
    const result = await lookup();
    if (result) return result;
  }
  return null;
};
