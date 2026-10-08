/**
 * @atlas
 * @kind helper
 * @partOf primitive:messaging
 * @uses feature:email
 */
import { type Condition, lensVisit } from '@inixiative/json-rules';
import type { RuleLens } from '@template/shared/rules';
import type { Sender } from '#/lib/email/sender';
import { senderLensOwner } from '#/lib/email/senderLensOwner';

const MEMBERSHIPS = ['organizationUsers', 'spaceUsers'] as const;

export const targetedBySender = (
  rule: Condition,
  recipient: RuleLens,
  sender: Sender,
): Condition => {
  const owner = senderLensOwner(sender);
  if (owner?.ownerModel !== 'Organization' && owner?.ownerModel !== 'Space') return rule;
  const shown = lensVisit(recipient, '')?.fields ?? {};
  const held = MEMBERSHIPS.filter((name) => shown[name]).map(
    (field): Condition => ({ field, arrayOperator: 'any', condition: true }) as Condition,
  );
  return { all: [rule, held.length ? { any: held } : false] };
};
