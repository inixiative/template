/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type ComponentNode, type Node, parseBlocks } from '@template/email/render/parseBlocks';

// Resolve the currently-stored body for a component slug, already walked through the
// owner cascade (tenant → parent → platform). `undefined` = the slug exists nowhere yet.
// Injected so this module stays pure and DB-free (mirrors renderBlocks' `load`).
export type ResolveCascade = (slug: string) => string | undefined;

// A component row to upsert: its slug, its reconstructed body, and the refs it owns.
export type ComponentWrite = { slug: string; mjml: string; refs: string[] };

export type DecomposeResult = {
  mjml: string; // the caller's stored form: bare refs + caller overrides, component bodies stripped out
  refs: string[]; // refs the caller owns (its top-level refs + any that rode in on caller-supplied overrides)
  writes: ComponentWrite[]; // components whose inlined body is new or diverged, child-first (FK-safe)
};

// Thrown when the SAME component slug appears more than once in one save payload with DIVERGENT
// inlined bodies. We refuse to guess which body the author meant — a genuine divergence is a
// validation error, not a silent last-wins pick. An IDENTICAL duplicate (same slug, byte-for-byte
// same body) is not an error: it collapses to one write.
export class DivergentDuplicateSlugError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(
      `Component slug "${slug}" appears more than once in this save payload with different inlined bodies. ` +
        'A single payload must carry at most one body per slug — the builder must not post two divergent ' +
        'occurrences of the same component ref.',
    );
    this.name = 'DivergentDuplicateSlugError';
    this.slug = slug;
  }
}

const slotTag = (name: string, isDefault: boolean): string => `slot:${name}${isDefault ? ':default' : ''}`;

// AST → string. Inverse of parseBlocks over the canonical forms it produces.
export const serialize = (nodes: Node[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return node.value;
      if (node.type === 'component')
        return `{{#component:${node.slug}}}${serialize(node.children)}{{/component:${node.slug}}}`;
      const tag = slotTag(node.name, node.isDefault);
      return `{{#${tag}}}${serialize(node.children)}{{/${tag}}}`;
    })
    .join('');

// `bodiesSeen` tracks EVERY inlined body encountered for a slug in this payload — whether that
// occurrence was a noop (matches cascade) or a divergence (write-worthy). The divergent-duplicate check
// compares across ALL occurrences, so "one occurrence equals the cascade, the other doesn't" is still
// caught as the two-different-bodies-for-one-slug case it is.
type Ctx = { resolve: ResolveCascade; writes: ComponentWrite[]; bodiesSeen: Map<string, string> };

// Walk nodes that belong to a *caller* (a template body, or a component's own body).
// Returns the caller-facing mjml + the refs the caller owns; nested component writes
// accumulate on ctx.writes (child-first).
const processCaller = (nodes: Node[], ctx: Ctx): { mjml: string; refs: string[] } => {
  let mjml = '';
  const refs: string[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      mjml += node.value;
      continue;
    }
    if (node.type === 'slot') {
      // A slot at caller level is the caller's own content (a `:default` region when the caller is a
      // component body; a fill region otherwise). Its inner refs belong to this same caller.
      const inner = processCaller(node.children, ctx);
      refs.push(...inner.refs);
      const tag = slotTag(node.name, node.isDefault);
      mjml += `{{#${tag}}}${inner.mjml}{{/${tag}}}`;
      continue;
    }
    const emitted = processComponentRef(node, ctx);
    refs.push(node.slug, ...emitted.bubbledRefs);
    mjml += emitted.mjml;
  }

  return { mjml, refs };
};

// A `{{#component:slug}}…{{/component:slug}}` occurrence. Its children split into:
//   - overrides (un-marked `{{#slot}}`) — caller-owned; stay inline on the caller's ref.
//   - body (chrome text, `{{#slot:…:default}}`, nested refs) — the component's OWN content, inlined
//     for single-pane editing. Diffed against the cascade; a divergence writes the component row.
// The caller always sees a bare ref carrying only the overrides — the body is stripped to its own row.
const processComponentRef = (node: ComponentNode, ctx: Ctx): { mjml: string; bubbledRefs: string[] } => {
  const overrides: Node[] = [];
  const body: Node[] = [];
  for (const child of node.children) {
    if (child.type === 'slot' && !child.isDefault) overrides.push(child);
    else body.push(child);
  }

  if (body.length) {
    // Recurse the component's own body: nested refs here are ITS refs, and any diverged nested
    // component bodies write first (child-first ordering falls out of the post-order push).
    const own = processCaller(body, ctx);

    // A divergent duplicate slug — the SAME slug carrying two different inlined bodies anywhere in this
    // payload — is a validation error, not last-wins. Checked against EVERY body seen for this slug so
    // far (not just the ones that produced a write): one occurrence happening to equal the cascade does
    // not make a second, divergent occurrence any less ambiguous.
    const previousBody = ctx.bodiesSeen.get(node.slug);
    if (previousBody !== undefined && previousBody !== own.mjml) {
      throw new DivergentDuplicateSlugError(node.slug);
    }
    ctx.bodiesSeen.set(node.slug, own.mjml);

    // First time we've seen this slug's body and it diverges from the cascade → a write. A second
    // occurrence with a different body threw above, so `writes` stays unique per slug without a collapse.
    if (previousBody === undefined && ctx.resolve(node.slug) !== own.mjml) {
      ctx.writes.push({ slug: node.slug, mjml: own.mjml, refs: own.refs });
    }
  } else {
    // A BARE ref (no inlined body) inherits the cascade body. Record that cascade body as the body
    // "seen" for this slug, so a LATER inlined occurrence that diverges from it is still caught: a bare
    // ref means "the author accepted the cascade body". Only when the slug actually resolves in the
    // cascade — a brand-new slug has nothing to inherit, so a later inlined occurrence is just a new
    // component the caller chose, with no baseline to diverge from.
    const effective = ctx.resolve(node.slug);
    if (effective !== undefined) {
      const previousBody = ctx.bodiesSeen.get(node.slug);
      if (previousBody !== undefined && previousBody !== effective) {
        throw new DivergentDuplicateSlugError(node.slug);
      }
      ctx.bodiesSeen.set(node.slug, effective);
    }
  }

  // Overrides are caller-owned: their inner refs bubble UP to the caller, not to this component.
  const ov = processCaller(overrides, ctx);
  return { mjml: `{{#component:${node.slug}}}${ov.mjml}{{/component:${node.slug}}}`, bubbledRefs: ov.refs };
};

// Decompose an ALREADY-PARSED tree — the single-parse entry point for callers (save.ts) that hold the
// parsed nodes and don't want a second parse + stray-tag scan of the largest strings in the system.
export const decomposeNodes = (nodes: Node[], resolve: ResolveCascade): DecomposeResult => {
  const ctx: Ctx = { resolve, writes: [], bodiesSeen: new Map() };
  const { mjml: out, refs } = processCaller(nodes, ctx);
  return { mjml: out, refs, writes: ctx.writes };
};

export const decompose = (mjml: string, resolve: ResolveCascade): DecomposeResult =>
  decomposeNodes(parseBlocks(mjml), resolve);

// Every component slug referenced anywhere in an already-parsed tree (nested, inside slots, and inside
// overrides). Used to batch the cascade lookup before diffing, off the same tree decompose walks.
export const collectSlugsFromNodes = (nodes: Node[]): string[] => {
  const out = new Set<string>();
  const walk = (ns: Node[]): void => {
    for (const node of ns) {
      if (node.type === 'component') out.add(node.slug);
      if (node.type !== 'text') walk(node.children);
    }
  };
  walk(nodes);
  return [...out];
};

// Same, from raw mjml (parses). Kept for callers that only hold the string.
export const collectSlugs = (mjml: string): string[] => collectSlugsFromNodes(parseBlocks(mjml));
