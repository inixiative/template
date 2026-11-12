/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, primitive:messaging
 * @uses infrastructure:prisma, feature:email
 */
import { type Condition, executePrismaPlan, toPrisma } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Contact, User } from '@template/db/generated/client/client';
import { scopeEmailLens } from '@template/email/rules';
import type { RuleLens } from '@template/shared/rules';

export type ResolvedUser = User & { contacts: Contact[] };

const PLATFORM_RECIPIENT_LENS = scopeEmailLens({}, null).recipient as RuleLens;

export const resolveUsers = async (
  rule: Condition,
  lens: RuleLens = PLATFORM_RECIPIENT_LENS,
): Promise<ResolvedUser[]> => {
  const plan = toPrisma(rule, { lens });
  const ruleWhere = await executePrismaPlan(plan, db as never);
  return db.user.findMany({
    where: { ...ruleWhere, deletedAt: null },
    include: { contacts: { where: { deletedAt: null } } },
  });
};
