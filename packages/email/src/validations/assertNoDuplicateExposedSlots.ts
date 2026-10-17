/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { ParseBlocksError } from '@template/email/errors/ParseBlocksError';
import { isOverrideSlot, type Node } from '@template/email/render/nodes';

export const assertNoDuplicateExposedSlots = (nodes: Node[], componentSlug?: string): void => {
  const seen = new Set<string>();
  const walk = (list: Node[], ancestorNames: ReadonlySet<string>): void => {
    for (const node of list) {
      if (node.type === 'slot') {
        const isShadowed = ancestorNames.has(node.name);
        if (!isShadowed) {
          if (seen.has(node.name)) {
            throw new ParseBlocksError(
              'duplicate_slot',
              `Slot "${node.name}" is exposed more than once in ${
                componentSlug ? `component "${componentSlug}"` : 'this component body'
              } — a component may expose each slot name at most once; a caller's single fill cannot target two injection points.`,
            );
          }
          seen.add(node.name);
        }
        walk(node.children, isShadowed ? ancestorNames : new Set([...ancestorNames, node.name]));
      } else if (node.type === 'component') {
        for (const child of node.children) {
          if (isOverrideSlot(child)) walk(child.children, ancestorNames);
        }
      }
    }
  };
  walk(nodes, new Set());
};
