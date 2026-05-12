import { type Condition, executePrismaQueryPlan, toPrisma } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Contact, User } from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';

export type ResolvedUser = User & { contacts: Contact[] };

/**
 * Resolve users matching a json-rules `Condition` against the User model.
 * The rule is the only argument — direct id matches are just rules
 * (`{ field: 'id', operator: 'equals', value: '…' }` or
 * `{ field: 'id', operator: 'in', value: [...] }`). Soft-deleted users
 * and contacts are excluded automatically.
 *
 * Contacts are eager-loaded so messageUser doesn't need a second round trip
 * to apply per-contact `canDeliver`.
 */
export const resolveUsers = async (rule: Condition): Promise<ResolvedUser[]> => {
  const plan = toPrisma(rule, { map: prismaMap as never, model: 'User' });
  const ruleWhere = await executePrismaQueryPlan(plan, db as never);
  return db.user.findMany({
    where: { ...ruleWhere, deletedAt: null },
    include: { contacts: { where: { deletedAt: null } } },
  });
};
