/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import { ParseBlocksError } from '@template/email/errors/ParseBlocksError';
import { BLOCK_TAG, SLUG_PATTERN } from '@template/email/render/blockTags';
import type { ComponentNode, Node, SlotNode } from '@template/email/render/nodes';
import { assertNoDuplicateOverrideSlots } from '@template/email/validations/assertNoDuplicateOverrideSlots';
import { assertNoStrayTagShapes } from '@template/email/validations/assertNoStrayTagShapes';

type Frame = { node: ComponentNode | SlotNode; kind: 'component' | 'slot'; name: string; children: Node[] };

export const parseBlocks = (input: string): Node[] => {
  assertNoStrayTagShapes(input);

  const root: Node[] = [];
  const stack: Frame[] = [];
  const current = (): Node[] => stack.at(-1)?.children ?? root;

  let cursor = 0;
  for (const match of input.matchAll(BLOCK_TAG)) {
    const [tag, marker, kind, name, defaultModifier] = match as unknown as [
      string,
      '#' | '/',
      'component' | 'slot',
      string,
      string | undefined,
    ];
    const index = match.index ?? 0;

    if (index > cursor) current().push({ type: 'text', value: input.slice(cursor, index) });
    cursor = index + tag.length;

    if (kind === 'component' && defaultModifier === 'default') {
      throw new ParseBlocksError(
        'invalid_modifier',
        `The :default modifier is slot-only — component tag ${tag} may not carry it.`,
      );
    }

    if (marker === '#') {
      if (!SLUG_PATTERN.test(name)) {
        throw new ParseBlocksError(
          'invalid_slug',
          `Invalid ${kind} name "${name}" — must match ^[a-z0-9-]+$ (tag: ${tag}).`,
        );
      }

      const node: ComponentNode | SlotNode =
        kind === 'component'
          ? { type: 'component', slug: name, children: [] }
          : { type: 'slot', name, isDefault: defaultModifier === 'default', children: [] };
      current().push(node);
      stack.push({ node, kind, name, children: node.children });
    } else {
      const top = stack.at(-1);
      if (!top) throw new ParseBlocksError('stray_close', `Stray close tag with no matching open: ${tag}`);
      if (top.kind !== kind || top.name !== name) {
        throw new ParseBlocksError(
          'mismatched_close',
          `Mismatched close tag: expected {{/${top.kind}:${top.name}}} but found ${tag}`,
        );
      }
      if (top.node.type === 'component') assertNoDuplicateOverrideSlots(top.node);
      stack.pop();
    }
  }

  const unclosed = stack.at(-1);
  if (unclosed) {
    throw new ParseBlocksError(
      'unclosed_open',
      `Unclosed ${unclosed.kind} block at end of input: {{#${unclosed.kind}:${unclosed.name}}}`,
    );
  }

  if (cursor < input.length) current().push({ type: 'text', value: input.slice(cursor) });
  return root;
};
