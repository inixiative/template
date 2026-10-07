/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, primitive:messaging
 * @uses infrastructure:prisma, feature:email
 */
import { type Condition, executePrismaPlan, narrowRule, toPrisma } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Contact, User } from '@template/db/generated/client/client';
import { rootLens } from '@template/db/lens';
import { defaultEmailLens, scopeEmailLens } from '@template/email/rules';
import type { RuleLens } from '@template/shared/rules';

export type ResolvedUser = User & { contacts: Contact[] };

const platformRecipientLens = (): RuleLens =>
  scopeEmailLens(defaultEmailLens, null).recipient as RuleLens;

export const resolveUsers = async (
  rule: Condition,
  lens: RuleLens = platformRecipientLens(),
): Promise<ResolvedUser[]> => {
  const root = 'parent' in lens ? rootLens(lens) : lens;
  const plan = toPrisma(narrowRule(rule, lens), {
    map: root,
    mapName: root.mapName,
    model: root.model,
  });
  const ruleWhere = await executePrismaPlan(plan, db as never);
  return db.user.findMany({
    where: { ...ruleWhere, deletedAt: null },
    include: { contacts: { where: { deletedAt: null } } },
  });
};
