/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type ComponentNode, type Node, parseBlocks } from '@template/email/render/parseBlocks';

export type LoadComponentBody = (slug: string) => Promise<string>;

export const renderBlocks = async (mjml: string, load: LoadComponentBody): Promise<string> => {
  return renderNodes(parseBlocks(mjml), load);
};

const renderNodes = async (nodes: Node[], load: LoadComponentBody): Promise<string> => {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') out += node.value;
    else if (node.type === 'component') out += await renderComponent(node, load);
    else out += await renderNodes(node.children, load);
  }
  return out;
};

const renderComponent = async (node: ComponentNode, load: LoadComponentBody): Promise<string> => {
  const overrides = new Map<string, Node[]>();
  for (const child of node.children) if (child.type === 'slot') overrides.set(child.name, child.children);

  const body = parseBlocks(await load(node.slug));
  return renderBody(body, overrides, load);
};

const renderBody = async (nodes: Node[], overrides: Map<string, Node[]>, load: LoadComponentBody): Promise<string> => {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') out += node.value;
    else if (node.type === 'component') out += await renderComponent(node, load);
    else out += await renderNodes(overrides.get(node.name) ?? node.children, load);
  }
  return out;
};
