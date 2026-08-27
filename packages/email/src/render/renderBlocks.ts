/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type ComponentNode, type Node, parseBlocks } from '@template/email/render/parseBlocks';

export type LoadComponentBody = (slug: string) => Promise<string>;

type RenderScope = { overrides: Map<string, Node[]>; parent: RenderScope | null };

export const renderBlocks = async (mjml: string, load: LoadComponentBody): Promise<string> => {
  return renderNodes(parseBlocks(mjml), { overrides: new Map(), parent: null }, load);
};

const renderNodes = async (nodes: Node[], scope: RenderScope, load: LoadComponentBody): Promise<string> => {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') out += node.value;
    else if (node.type === 'component') out += await renderComponent(node, scope, load);
    else {
      const override = scope.overrides.get(node.name);
      out +=
        override !== undefined
          ? await renderNodes(override, scope.parent ?? scope, load)
          : await renderNodes(node.children, scope, load);
    }
  }
  return out;
};

const renderComponent = async (node: ComponentNode, scope: RenderScope, load: LoadComponentBody): Promise<string> => {
  const overrides = new Map<string, Node[]>();
  for (const child of node.children) if (child.type === 'slot') overrides.set(child.name, child.children);

  const body = parseBlocks(await load(node.slug));
  return renderNodes(body, { overrides, parent: scope }, load);
};
