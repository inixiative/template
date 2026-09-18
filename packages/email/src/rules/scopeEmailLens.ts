/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type Condition, type NarrowingDefaults, Operator, resolveLensBindings } from '@inixiative/json-rules';
import { PolymorphismRegistry } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { type EmailLens, narrowEmailLens } from '@template/email/rules/emailLens';
import type { RuleLens } from '@template/shared/rules';

export type EmailLensOwner = { ownerModel: ProviderModel; ownerId: string } | null;

const OWNER_BIND = 'ownerId';

const live: Condition = { field: 'deletedAt', operator: Operator.notExists };
const platform: Condition = { field: 'ownerModel', operator: Operator.equals, value: 'platform' };

const ownerFk = (model: 'Tag' | 'Segment', ownerModel: ProviderModel): string =>
  PolymorphismRegistry[model]!.axes[0]!.fkMap[ownerModel]![0]!;

const ownedBy = (model: 'Tag' | 'Segment', ownerModel: ProviderModel): Condition => ({
  field: ownerFk(model, ownerModel),
  operator: Operator.equals,
  bind: OWNER_BIND,
});

const ownerDefaults = (owner: EmailLensOwner): NarrowingDefaults => {
  const tag: Condition = { all: [live, owner ? { any: [platform, ownedBy('Tag', owner.ownerModel)] } : platform] };
  const segment: Condition = owner ? { all: [ownedBy('Segment', owner.ownerModel), live] } : false;
  return {
    models: {
      Tag: { where: tag, sources: { id: { where: tag } } },
      Segment: { where: segment, sources: { id: { where: segment } } },
    },
  };
};

export const scopeEmailLens = (lens: EmailLens, owner: EmailLensOwner): EmailLens => {
  const defaults = ownerDefaults(owner);
  return narrowEmailLens(lens, (_root, slot) => {
    const scoped: RuleLens = { parent: slot, mapDefaults: { prisma: defaults } };
    return owner ? (resolveLensBindings(scoped, { [OWNER_BIND]: owner.ownerId }) as RuleLens) : scoped;
  });
};
