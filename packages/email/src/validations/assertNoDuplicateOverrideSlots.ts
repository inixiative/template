/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { ParseBlocksError } from '@template/email/errors/ParseBlocksError';
import { type ComponentNode, isOverrideSlot } from '@template/email/render/nodes';

export const assertNoDuplicateOverrideSlots = (node: ComponentNode): void => {
  const seen = new Set<string>();
  for (const child of node.children) {
    if (!isOverrideSlot(child)) continue;
    if (seen.has(child.name)) {
      throw new ParseBlocksError(
        'duplicate_slot',
        `Duplicate override slot "${child.name}" on component ref "${node.slug}" — a ref may fill each named slot at most once.`,
      );
    }
    seen.add(child.name);
  }
};
