/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type Condition, type NarrowingDefaults, Operator, resolveLensBindings } from '@inixiative/json-rules';
import { ownedBy, ownerBindings } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { type EmailLens, narrowEmailLens } from '@template/email/rules/emailLens';
import type { RuleLens } from '@template/shared/rules';

export type EmailLensOwner = { ownerModel: ProviderModel; ownerId: string; organizationId?: string | null } | null;

const live: Condition = { field: 'deletedAt', operator: Operator.notExists };
const platform: Condition = { field: 'ownerModel', operator: Operator.equals, value: 'platform' };

const tag: Condition = { all: [live, { any: [platform, ownedBy('Tag', 'ownerModel')] }] };
const segment: Condition = { all: [ownedBy('Segment', 'ownerModel'), live] };
const platformDefaults: NarrowingDefaults = {
  models: {
    Tag: { where: tag, sources: { id: { where: tag } } },
    Segment: { where: segment, sources: { id: { where: segment } } },
  },
};

const is = (field: string, value: string): Condition => ({ field, operator: Operator.equals, value });

type Owner = NonNullable<EmailLensOwner>;

const organizationScope = (owner: Owner): Condition =>
  owner.ownerModel === 'Organization'
    ? is('id', owner.ownerId)
    : owner.organizationId
      ? is('id', owner.organizationId)
      : false;

const spaceScope = (owner: Owner): Condition =>
  owner.ownerModel === 'Space'
    ? is('id', owner.ownerId)
    : owner.ownerModel === 'Organization'
      ? is('organizationId', owner.ownerId)
      : false;

const ownerDefaults = (owner: Owner): NarrowingDefaults => ({
  models: {
    ...platformDefaults.models,
    Organization: { sources: { id: { where: organizationScope(owner) } } },
    Space: { sources: { id: { where: spaceScope(owner) } } },
  },
});

export const scopeEmailLens = (lens: EmailLens, owner: EmailLensOwner): EmailLens =>
  narrowEmailLens(lens, (_root, slot) => {
    if (!owner) return { parent: slot, mapDefaults: { prisma: platformDefaults } };
    const scoped: RuleLens = { parent: slot, mapDefaults: { prisma: ownerDefaults(owner) } };
    return resolveLensBindings(scoped, ownerBindings(owner.ownerModel, owner.ownerId)) as RuleLens;
  });
