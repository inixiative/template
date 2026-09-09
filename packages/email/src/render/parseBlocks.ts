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

export const isOverrideSlot = (node: Node): node is SlotNode => node.type === 'slot' && !node.isDefault;

export type ParseBlocksErrorReason =
  | 'mismatched_close'
  | 'stray_close'
  | 'unclosed_open'
  | 'invalid_slug'
  | 'invalid_modifier'
  | 'duplicate_slot';

export class ParseBlocksError extends Error {
  readonly reason: ParseBlocksErrorReason;

  constructor(reason: ParseBlocksErrorReason, message: string) {
    super(message);
    this.name = 'ParseBlocksError';
    this.reason = reason;
  }
}

export const SLUG_PATTERN = /^[a-z0-9-]+$/;

const TAG = /\{\{(#|\/)(component|slot):([a-z0-9-]+)(?::(default))?\}\}/g;

export const componentTagPattern = (): RegExp => new RegExp(TAG.source, TAG.flags);

const TAG_SHAPED = /\{\{\s*(#|\/)\s*(component|slot)\s*:[^}]*\}\}/g;

const CLASSIFY_TAG = /^\{\{\s*[#/]\s*(?:component|slot)\s*:\s*([^}:]*?)\s*(?::[^}]*)?\}\}$/;

type Frame = { node: ComponentNode | SlotNode; kind: 'component' | 'slot'; name: string; children: Node[] };

const assertNoStrayTagShapes = (input: string): void => {
  const shaped = new Map<number, string>();
  for (const shapedMatch of input.matchAll(TAG_SHAPED)) shaped.set(shapedMatch.index ?? 0, shapedMatch[0]);
  for (const cleanMatch of input.matchAll(TAG)) shaped.delete(cleanMatch.index ?? 0);

  if (shaped.size === 0) return;

  const firstIndex = Math.min(...shaped.keys());
  const offending = shaped.get(firstIndex) ?? input.slice(firstIndex, firstIndex + 40);

  const badName = CLASSIFY_TAG.exec(offending)?.[1];
  if (badName !== undefined && badName !== '' && !SLUG_PATTERN.test(badName)) {
    throw new ParseBlocksError(
      'invalid_slug',
      `Invalid component/slot name "${badName}" — must match ^[a-z0-9-]+$ (tag: ${offending}).`,
    );
  }

  throw new ParseBlocksError(
    'mismatched_close',
    `Malformed component/slot tag near "${input.slice(firstIndex, firstIndex + 40)}" — whitespace-spaced or otherwise non-canonical tags are rejected, not silently treated as text.`,
  );
};

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

const assertNoDuplicateOverrideSlots = (node: ComponentNode): void => {
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

export const parseBlocks = (input: string): Node[] => {
  assertNoStrayTagShapes(input);

  const root: Node[] = [];
  const stack: Frame[] = [];
  const current = (): Node[] => stack.at(-1)?.children ?? root;

  let cursor = 0;
  for (const match of input.matchAll(TAG)) {
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
