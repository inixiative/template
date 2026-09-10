/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
export type TextNode = { type: 'text'; value: string };
export type SlotNode = { type: 'slot'; name: string; isDefault: boolean; children: Node[] };
export type ComponentNode = { type: 'component'; slug: string; children: Node[] };
export type Node = TextNode | ComponentNode | SlotNode;

export const isOverrideSlot = (node: Node): node is SlotNode => node.type === 'slot' && !node.isDefault;

export const collectSlugsFromNodes = (nodes: Node[]): string[] => {
  const out = new Set<string>();
  const walk = (list: Node[]): void => {
    for (const node of list) {
      if (node.type === 'component') out.add(node.slug);
      if (node.type !== 'text') walk(node.children);
    }
  };
  walk(nodes);
  return [...out];
};
