/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { serialize } from '@template/email/render/decompose';
import { EmailRenderError } from '@template/email/render/errors';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { type ComponentNode, type Node, parseBlocks, type SlotNode } from '@template/email/render/parseBlocks';
import type { OwnerScope } from '@template/email/render/types';

// Resolve component slugs' cascade bodies for hydration. `undefined` for a slug = it isn't resolvable
// (a dangling ref — e.g. deleted out from under a template). Injected so the walker stays pure; the
// DB-backed convenience is hydrateCascade below.
export type ResolveHydrateBodies = (slugs: string[]) => Promise<Record<string, string | undefined>>;

// Inverse of decompose: where decompose STRIPS a ref's inlined body back out (keeping only overrides),
// hydrate INJECTS a ref's cascade-resolved body back IN (keeping existing overrides as-is), recursively —
// turning the stored form (bare refs) into the single-pane editing form. `decompose(hydrate(x))` on an
// unedited payload is a true round-trip (the original mjml back out, zero writes), so the editor can load
// a stored template, change nothing, and save without churn. A dangling ref (a slug the cascade can't
// resolve) is left as a bare ref rather than throwing: a read surfaces a stale reference passively, unlike
// a send-time expand which fails. A persisted cascade cycle is bounded with a typed
// EmailRenderError('circular_ref') instead of recursing until the stack blows.
export const hydrate = async (mjml: string, resolve: ResolveHydrateBodies): Promise<string> =>
  serialize(await hydrateNodes(parseBlocks(mjml), resolve, []));

// hydrate, resolving bodies through the DB-backed owner cascade for ctx — the convenience most callers
// want, mirroring how expand defaults to lookupCascade.
export const hydrateCascade = (mjml: string, ctx: OwnerScope): Promise<string> => {
  const resolve: ResolveHydrateBodies = async (slugs) => {
    const components = await lookupCascade(slugs, ctx);
    return Object.fromEntries(slugs.map((slug) => [slug, components[slug]?.mjml]));
  };
  return hydrate(mjml, resolve);
};

const hydrateNodes = async (nodes: Node[], resolve: ResolveHydrateBodies, path: string[]): Promise<Node[]> => {
  const slugs = [
    ...new Set(nodes.filter((node): node is ComponentNode => node.type === 'component').map((node) => node.slug)),
  ];
  const bodies = slugs.length ? await resolve(slugs) : {};

  const out: Node[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      out.push(node);
      continue;
    }
    if (node.type === 'slot') {
      out.push({ ...node, children: await hydrateNodes(node.children, resolve, path) });
      continue;
    }
    out.push(await hydrateComponentRef(node, bodies[node.slug], resolve, path));
  }
  return out;
};

const hydrateComponentRef = async (
  node: ComponentNode,
  body: string | undefined,
  resolve: ResolveHydrateBodies,
  path: string[],
): Promise<ComponentNode> => {
  // A ref's ONLY meaningful children are its override slots. Bare content sitting directly inside a ref
  // (not in a slot) is dropped, exactly as expand does at render — keeping it would double the body in the
  // editor and, on save, decompose would write the doubled content back as the component's own.
  const overrideNodes = node.children.filter((child): child is SlotNode => child.type === 'slot' && !child.isDefault);
  // Overrides are the CALLER's content — recurse at the caller's path, not the component's, so a component
  // legitimately nested inside its own override slot is not mistaken for a cycle.
  const overrides = await hydrateNodes(overrideNodes, resolve, path);

  if (body === undefined) return { ...node, children: overrides };

  if (path.includes(node.slug)) throw new EmailRenderError(node.slug, 'circular_ref', [...path, node.slug]);

  // The component's own body, recursively hydrated down the cascade chain. Its own caller-level slots are
  // normalized to :default: decompose needs the positional distinction back, or it reclassifies the
  // component's own slot as a caller override and amputates it.
  const hydratedBody = markOwnBodySlotsDefault(await hydrateNodes(parseBlocks(body), resolve, [...path, node.slug]));
  return { ...node, children: [...hydratedBody, ...overrides] };
};

// Mark a component body's OWN slots (caller-level: reachable without crossing into a nested component ref)
// as :default. Render-equivalent per expand, which keys injection on slot NAME and ignores the modifier —
// the modifier only matters to decompose's attribution and serialize's output.
const markOwnBodySlotsDefault = (nodes: Node[]): Node[] =>
  nodes.map((node) =>
    node.type === 'slot' ? { ...node, isDefault: true, children: markOwnBodySlotsDefault(node.children) } : node,
  );
