/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
export type TextNode = { type: 'text'; value: string };
export type SlotNode = { type: 'slot'; name: string; isDefault: boolean; children: Node[] };
export type ComponentNode = { type: 'component'; slug: string; children: Node[] };
export type Node = TextNode | ComponentNode | SlotNode;

const TAG = /\{\{(#|\/)(component|slot):([a-z0-9-]+)(?::(default))?\}\}/g;

type Frame = { node: ComponentNode | SlotNode; children: Node[] };

export const parseBlocks = (input: string): Node[] => {
  const root: Node[] = [];
  const stack: Frame[] = [];
  const current = (): Node[] => (stack.length ? stack[stack.length - 1].children : root);

  let cursor = 0;
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop idiom
  while ((match = TAG.exec(input)) !== null) {
    const [tag, marker, kind, name, defaultModifier] = match;

    if (match.index > cursor) current().push({ type: 'text', value: input.slice(cursor, match.index) });
    cursor = match.index + tag.length;

    if (marker === '#') {
      const node: ComponentNode | SlotNode =
        kind === 'component'
          ? { type: 'component', slug: name, children: [] }
          : { type: 'slot', name, isDefault: defaultModifier === 'default', children: [] };
      current().push(node);
      stack.push({ node, children: node.children });
    } else {
      stack.pop();
    }
  }

  if (cursor < input.length) current().push({ type: 'text', value: input.slice(cursor) });
  return root;
};
