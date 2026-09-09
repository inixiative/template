/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { serialize } from '@template/email/render/decompose';
import {
  type ComponentNode,
  isOverrideSlot,
  type Node,
  ParseBlocksError,
  parseBlocks,
  type SlotNode,
} from '@template/email/render/parseBlocks';

export type ComponentRegion = {
  slug: string;
  path: number[];
  depth: number;
  hasBody: boolean;
  overrideSlots: string[];
  occurrenceIndex: number;
};

const overriddenNames = (nodes: Node[]): Set<string> => new Set(nodes.filter(isOverrideSlot).map((node) => node.name));

const forEachRenderedComponent = (
  nodes: Node[],
  visit: (node: ComponentNode, path: number[], depth: number) => 'continue' | 'stop',
  path: number[] = [],
  depth = 0,
): 'continue' | 'stop' => {
  const overridden = overriddenNames(nodes);
  for (const [index, node] of nodes.entries()) {
    if (node.type === 'text') continue;
    const nodePath = [...path, index];
    if (node.type === 'component') {
      if (visit(node, nodePath, depth) === 'stop') return 'stop';
      if (forEachRenderedComponent(node.children, visit, nodePath, depth + 1) === 'stop') return 'stop';
    } else if (!(node.isDefault && overridden.has(node.name))) {
      if (forEachRenderedComponent(node.children, visit, nodePath, depth) === 'stop') return 'stop';
    }
  }
  return 'continue';
};

export const collectComponentRegionsFromNodes = (roots: Node[]): ComponentRegion[] => {
  const regions: ComponentRegion[] = [];
  const occurrenceCounts = new Map<string, number>();

  forEachRenderedComponent(roots, (node, path, depth) => {
    const occurrenceIndex = occurrenceCounts.get(node.slug) ?? 0;
    occurrenceCounts.set(node.slug, occurrenceIndex + 1);
    regions.push({
      slug: node.slug,
      path,
      depth,
      hasBody: node.children.some((child) => !isOverrideSlot(child)),
      overrideSlots: node.children.filter(isOverrideSlot).map((child) => child.name),
      occurrenceIndex,
    });
    return 'continue';
  });

  return regions;
};

export const collectComponentRegions = (mjml: string): ComponentRegion[] =>
  collectComponentRegionsFromNodes(parseBlocks(mjml));

const componentAtOccurrence = (roots: Node[], slug: string, occurrenceIndex: number): ComponentNode => {
  let found: ComponentNode | undefined;
  let seen = -1;

  forEachRenderedComponent(roots, (node) => {
    if (node.slug !== slug) return 'continue';
    seen += 1;
    if (seen !== occurrenceIndex) return 'continue';
    found = node;
    return 'stop';
  });

  if (!found) {
    throw new Error(
      `No "${slug}" occurrence #${occurrenceIndex} left in the source — region handles are stale after any edit.`,
    );
  }
  return found;
};

export const collapseComponentBodies = (mjml: string, slug: string): string => {
  const roots = parseBlocks(mjml);
  let collapsed = 0;

  const walk = (nodes: Node[]): void => {
    for (const node of nodes) {
      if (node.type === 'text') continue;
      if (node.type === 'component' && node.slug === slug) {
        node.children = node.children.filter(isOverrideSlot);
        collapsed += 1;
      }
      walk(node.children);
    }
  };

  walk(roots);
  if (collapsed === 0) {
    throw new Error(`No "${slug}" component ref left in the source — region handles are stale after any edit.`);
  }
  return serialize(roots);
};

export const removeSlotOverride = (
  mjml: string,
  region: Pick<ComponentRegion, 'slug' | 'occurrenceIndex'>,
  slotName: string,
): string => {
  const roots = parseBlocks(mjml);
  const node = componentAtOccurrence(roots, region.slug, region.occurrenceIndex);
  node.children = node.children.filter((child) => !(isOverrideSlot(child) && child.name === slotName));
  return serialize(roots);
};

export const slotDefaultContent = (storedBody: string, slotName: string): string | undefined => {
  const find = (nodes: Node[]): SlotNode | undefined => {
    for (const node of nodes) {
      if (node.type === 'text') continue;
      if (node.type === 'slot' && node.isDefault && node.name === slotName) return node;
      const nested = find(node.children);
      if (nested) return nested;
    }
    return undefined;
  };

  let roots: Node[];
  try {
    roots = parseBlocks(storedBody);
  } catch (error) {
    if (error instanceof ParseBlocksError) return undefined;
    throw error;
  }

  const slot = find(roots);
  return slot ? serialize(slot.children) : undefined;
};
