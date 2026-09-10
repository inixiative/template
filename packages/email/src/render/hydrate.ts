/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */

import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { serialize } from '@template/email/render/decompose';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { ComponentNode, Node, SlotNode } from '@template/email/render/nodes';
import { parseBlocks } from '@template/email/render/parseBlocks';
import type { OwnerScope } from '@template/email/render/types';

export type ResolveHydrateBodies = (slugs: string[]) => Promise<Record<string, string | undefined>>;

export const hydrate = async (mjml: string, resolve: ResolveHydrateBodies): Promise<string> =>
  serialize(await hydrateNodes(parseBlocks(mjml), resolve, []));

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
  const overrideNodes = node.children.filter((child): child is SlotNode => child.type === 'slot' && !child.isDefault);
  const overrides = await hydrateNodes(overrideNodes, resolve, path);

  if (body === undefined) return { ...node, children: overrides };

  if (path.includes(node.slug)) throw new EmailRenderError(node.slug, 'circular_ref', [...path, node.slug]);

  const hydratedBody = markOwnBodySlotsDefault(await hydrateNodes(parseBlocks(body), resolve, [...path, node.slug]));
  return { ...node, children: [...hydratedBody, ...overrides] };
};

const markOwnBodySlotsDefault = (nodes: Node[]): Node[] =>
  nodes.map((node) =>
    node.type === 'slot' ? { ...node, isDefault: true, children: markOwnBodySlotsDefault(node.children) } : node,
  );
