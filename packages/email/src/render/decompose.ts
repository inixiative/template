/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { DivergentDuplicateSlugError } from '@template/email/errors/DivergentDuplicateSlugError';
import { type ComponentNode, collectSlugsFromNodes, type Node } from '@template/email/render/nodes';
import { parseBlocks } from '@template/email/render/parseBlocks';

export type ResolveCascade = (slug: string) => string | undefined;

export type ComponentWrite = { slug: string; mjml: string; refs: string[] };

export type DecomposeResult = { mjml: string; refs: string[]; writes: ComponentWrite[] };

const slotTag = (name: string, isDefault: boolean): string => `slot:${name}${isDefault ? ':default' : ''}`;

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

type Ctx = { resolve: ResolveCascade; writes: ComponentWrite[]; bodiesSeen: Map<string, string> };

const recordBody = (slug: string, body: string, ctx: Ctx): string | undefined => {
  const previous = ctx.bodiesSeen.get(slug);
  if (previous !== undefined && previous !== body) throw new DivergentDuplicateSlugError(slug);
  ctx.bodiesSeen.set(slug, body);
  return previous;
};

const processCaller = (nodes: Node[], ctx: Ctx): { mjml: string; refs: string[] } => {
  let mjml = '';
  const refs: string[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      mjml += node.value;
      continue;
    }
    if (node.type === 'slot') {
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

const processComponentRef = (node: ComponentNode, ctx: Ctx): { mjml: string; bubbledRefs: string[] } => {
  const overrides: Node[] = [];
  const body: Node[] = [];
  for (const child of node.children) {
    if (child.type === 'slot' && !child.isDefault) overrides.push(child);
    else body.push(child);
  }

  if (body.length) {
    const own = processCaller(body, ctx);
    const previous = recordBody(node.slug, own.mjml, ctx);
    if (previous === undefined && ctx.resolve(node.slug) !== own.mjml) {
      ctx.writes.push({ slug: node.slug, mjml: own.mjml, refs: own.refs });
    }
  } else {
    const inherited = ctx.resolve(node.slug);
    if (inherited !== undefined) recordBody(node.slug, inherited, ctx);
  }

  const ov = processCaller(overrides, ctx);
  return { mjml: `{{#component:${node.slug}}}${ov.mjml}{{/component:${node.slug}}}`, bubbledRefs: ov.refs };
};

export const decomposeNodes = (nodes: Node[], resolve: ResolveCascade): DecomposeResult => {
  const ctx: Ctx = { resolve, writes: [], bodiesSeen: new Map() };
  const { mjml, refs } = processCaller(nodes, ctx);
  return { mjml, refs, writes: ctx.writes };
};

export const decompose = (mjml: string, resolve: ResolveCascade): DecomposeResult =>
  decomposeNodes(parseBlocks(mjml), resolve);

export const collectSlugs = (mjml: string): string[] => collectSlugsFromNodes(parseBlocks(mjml));
