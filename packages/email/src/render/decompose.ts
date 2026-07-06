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

const slotTag = (name: string, isDefault: boolean): string => `slot:${name}${isDefault ? ':default' : ''}`;

// AST → string. Inverse of parseBlocks over the canonical forms it produces.
export const serialize = (nodes: Node[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return node.value;
      if (node.type === 'component') return `{{#component:${node.slug}}}${serialize(node.children)}{{/component:${node.slug}}}`;
      const tag = slotTag(node.name, node.isDefault);
      return `{{#${tag}}}${serialize(node.children)}{{/${tag}}}`;
    })
    .join('');

type Ctx = { resolve: ResolveCascade; writes: ComponentWrite[] };

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
    if (ctx.resolve(node.slug) !== own.mjml) {
      ctx.writes.push({ slug: node.slug, mjml: own.mjml, refs: own.refs });
    }
  }

  // Overrides are caller-owned: their inner refs bubble UP to the caller, not to this component.
  const ov = processCaller(overrides, ctx);
  return { mjml: `{{#component:${node.slug}}}${ov.mjml}{{/component:${node.slug}}}`, bubbledRefs: ov.refs };
};

export const decompose = (mjml: string, resolve: ResolveCascade): DecomposeResult => {
  const ctx: Ctx = { resolve, writes: [] };
  const { mjml: out, refs } = processCaller(parseBlocks(mjml), ctx);
  return { mjml: out, refs, writes: ctx.writes };
};

// Every component slug referenced anywhere in the payload (nested, inside slots, and inside
// overrides). Used to batch the cascade lookup before diffing.
export const collectSlugs = (mjml: string): string[] => {
  const out = new Set<string>();
  const walk = (nodes: Node[]): void => {
    for (const node of nodes) {
      if (node.type === 'component') out.add(node.slug);
      if (node.type !== 'text') walk(node.children);
    }
  };
  walk(parseBlocks(mjml));
  return [...out];
};
