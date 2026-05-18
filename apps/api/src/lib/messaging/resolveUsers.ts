import { type Condition, executePrismaQueryPlan, toPrisma } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Contact, User } from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';

export type ResolvedUser = User & { contacts: Contact[] };

export const resolveUsers = async (rule: Condition): Promise<ResolvedUser[]> => {
  const plan = toPrisma(rule, { map: prismaMap as never, model: 'User' });
  const ruleWhere = await executePrismaQueryPlan(plan, db as never);
  return db.user.findMany({
    where: { ...ruleWhere, deletedAt: null },
    include: { contacts: { where: { deletedAt: null } } },
  });
};
