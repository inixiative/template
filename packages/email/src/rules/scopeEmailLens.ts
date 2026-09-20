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

export type EmailLensOwner = { ownerModel: ProviderModel; ownerId: string } | null;

const live: Condition = { field: 'deletedAt', operator: Operator.notExists };
const platform: Condition = { field: 'ownerModel', operator: Operator.equals, value: 'platform' };

const tag: Condition = { all: [live, { any: [platform, ownedBy('Tag', 'ownerModel')] }] };
const segment: Condition = { all: [ownedBy('Segment', 'ownerModel'), live] };

const ownerDefaults: NarrowingDefaults = {
  models: {
    Tag: { where: tag, sources: { id: { where: tag } } },
    Segment: { where: segment, sources: { id: { where: segment } } },
  },
};

export const scopeEmailLens = (lens: EmailLens, owner: EmailLensOwner): EmailLens =>
  narrowEmailLens(lens, (_root, slot) => {
    const scoped: RuleLens = { parent: slot, mapDefaults: { prisma: ownerDefaults } };
    return owner ? (resolveLensBindings(scoped, ownerBindings(owner.ownerModel, owner.ownerId)) as RuleLens) : scoped;
  });
