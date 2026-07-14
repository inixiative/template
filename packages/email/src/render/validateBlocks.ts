/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
export type BlockErrorReason =
  | 'mismatched_close'
  | 'stray_close'
  | 'unclosed_open'
  | 'invalid_slug'
  | 'invalid_modifier'
  | 'duplicate_slot';

export class BlockValidationError extends Error {
  readonly reason: BlockErrorReason;

  constructor(reason: BlockErrorReason, message: string) {
    super(message);
    this.name = 'BlockValidationError';
    this.reason = reason;
  }
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const TAG = /\{\{(#|\/)(component|slot):([a-z0-9-]+)(?::(default))?\}\}/g;

const TAG_SHAPED = /\{\{\s*(#|\/)\s*(component|slot)\s*:[^}]*\}\}/g;

const CLASSIFY_TAG = /^\{\{\s*[#/]\s*(?:component|slot)\s*:\s*([^}:]*?)\s*(?::[^}]*)?\}\}$/;

// parseBlocks (the render parser) is deliberately lenient — garbage-in, best-effort-out — so a
// slightly-malformed stored template still renders something at send time. This is the authoring gate:
// the same grammar, enforced strictly, so a malformed payload 422s at save instead of silently
// corrupting the caller's stored MJML or its cascade-diff.
const assertNoStrayTagShapes = (input: string): void => {
  const shaped = new Map<number, string>();
  for (const shapedMatch of input.matchAll(TAG_SHAPED)) shaped.set(shapedMatch.index ?? 0, shapedMatch[0]);
  for (const cleanMatch of input.matchAll(TAG)) shaped.delete(cleanMatch.index ?? 0);

  if (shaped.size === 0) return;

  const firstIndex = Math.min(...shaped.keys());
  const offending = shaped.get(firstIndex) ?? input.slice(firstIndex, firstIndex + 40);

  const badName = CLASSIFY_TAG.exec(offending)?.[1];
  if (badName !== undefined && badName !== '' && !SLUG_PATTERN.test(badName)) {
    throw new BlockValidationError(
      'invalid_slug',
      `Invalid component/slot name "${badName}" — must match ^[a-z0-9-]+$ (tag: ${offending}).`,
    );
  }

  throw new BlockValidationError(
    'mismatched_close',
    `Malformed component/slot tag near "${input.slice(firstIndex, firstIndex + 40)}" — whitespace-spaced or otherwise non-canonical tags are rejected, not silently treated as text.`,
  );
};

type Frame = { kind: 'component' | 'slot'; name: string; isDefault: boolean; overrideSlots: Set<string> };

export const validateBlocks = (input: string): void => {
  assertNoStrayTagShapes(input);

  const stack: Frame[] = [];
  for (const match of input.matchAll(TAG)) {
    const [tag, marker, kind, name, defaultModifier] = match as unknown as [
      string,
      '#' | '/',
      'component' | 'slot',
      string,
      string | undefined,
    ];

    if (kind === 'component' && defaultModifier === 'default') {
      throw new BlockValidationError(
        'invalid_modifier',
        `The :default modifier is slot-only — component tag ${tag} may not carry it.`,
      );
    }

    if (marker === '#') {
      stack.push({ kind, name, isDefault: kind === 'slot' && defaultModifier === 'default', overrideSlots: new Set() });
      continue;
    }

    const top = stack.at(-1);
    if (!top) throw new BlockValidationError('stray_close', `Stray close tag with no matching open: ${tag}`);
    if (top.kind !== kind || top.name !== name) {
      throw new BlockValidationError(
        'mismatched_close',
        `Mismatched close tag: expected {{/${top.kind}:${top.name}}} but found ${tag}`,
      );
    }
    stack.pop();

    if (top.kind === 'slot' && !top.isDefault) {
      const parent = stack.at(-1);
      if (parent?.kind === 'component') {
        if (parent.overrideSlots.has(top.name)) {
          throw new BlockValidationError(
            'duplicate_slot',
            `Duplicate override slot "${top.name}" on component ref "${parent.name}" — a ref may fill each named slot at most once.`,
          );
        }
        parent.overrideSlots.add(top.name);
      }
    }
  }

  const unclosed = stack.at(-1);
  if (unclosed) {
    throw new BlockValidationError(
      'unclosed_open',
      `Unclosed ${unclosed.kind} block at end of input: {{#${unclosed.kind}:${unclosed.name}}}`,
    );
  }
};
