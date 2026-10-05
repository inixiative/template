/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { lookupCascade } from '@template/email/render/lookupCascade';
import {
  type ComponentNode,
  collectSlugsFromNodes,
  isOverrideSlot,
  type Node,
} from '@template/email/render/nodes';
import { parseBlocks } from '@template/email/render/parseBlocks';
import type { OwnerScope, RenderObserver } from '@template/email/render/types';

export type LookupComponents = (
  slugs: string[],
) => Promise<Record<string, { mjml: string } | undefined>>;

type ComponentCache = Map<string, Node[] | null>;

type Renderer = { lookup: LookupComponents; cache: ComponentCache; observer?: RenderObserver };

type RenderScope = {
  overrides: Map<string, Node[]>;
  path: string[];
  parent: RenderScope | null;
};

export const expandWith = async (
  mjml: string,
  lookup: LookupComponents,
  observer?: RenderObserver,
): Promise<string> =>
  renderNodes(
    parseBlocks(mjml),
    { overrides: new Map(), path: [], parent: null },
    { lookup, cache: new Map(), observer },
  );

export const expand = (mjml: string, ctx: OwnerScope, observer?: RenderObserver): Promise<string> =>
  expandWith(mjml, (slugs) => lookupCascade(slugs, ctx), observer);

const loadComponents = async (slugs: string[], renderer: Renderer): Promise<void> => {
  const missing = [...new Set(slugs)].filter((slug) => !renderer.cache.has(slug));
  if (!missing.length) return;

  const components = await renderer.lookup(missing);
  for (const slug of missing) {
    const component = Object.hasOwn(components, slug) ? components[slug] : undefined;
    renderer.cache.set(slug, component ? parseBlocks(component.mjml) : null);
  }
};

const renderNodes = async (
  nodes: Node[],
  scope: RenderScope,
  renderer: Renderer,
): Promise<string> => {
  await loadComponents(collectSlugsFromNodes(nodes), renderer);

  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') out += node.value;
    else if (node.type === 'component') out += await renderComponentRef(node, scope, renderer);
    else {
      const override = scope.overrides.get(node.name);
      out +=
        override !== undefined
          ? await renderNodes(override, scope.parent ?? scope, renderer)
          : await renderNodes(node.children, scope, renderer);
    }
  }
  return out;
};

const renderComponentRef = async (
  node: ComponentNode,
  scope: RenderScope,
  renderer: Renderer,
): Promise<string> => {
  if (scope.path.includes(node.slug)) {
    const error = new EmailRenderError(node.slug, 'circular_ref', [...scope.path, node.slug]);
    if (!renderer.observer?.onRenderFailure) throw error;
    renderer.observer.onRenderFailure(error);
    return '';
  }

  const overrides = new Map<string, Node[]>();
  for (const child of node.children) {
    if (isOverrideSlot(child)) overrides.set(child.name, child.children);
  }

  await loadComponents([node.slug], renderer);
  const body = renderer.cache.get(node.slug);
  if (!body) {
    const error = new EmailRenderError(node.slug, 'component_missing');
    if (!renderer.observer?.onRenderFailure) throw error;
    renderer.observer.onRenderFailure(error);
    return '';
  }

  return renderNodes(
    body,
    { overrides, path: [...scope.path, node.slug], parent: scope },
    renderer,
  );
};
