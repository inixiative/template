/**
 * Component syntax: {{#component:slug}}content{{/component:slug}}
 * Output tags variants: {{#component:slug:0}}content{{/component:slug:0}}
 * Slugs: lowercase, numbers, hyphens only.
 */

const OPEN_TAG = /\{\{#component:([a-z0-9-]+)\}\}/g;

export type MappedComponent = {
  mjml: string; // Tagged, nested refs cleaned to empty tags
  refs: string[]; // Direct child refs ["logo:0", "nav:1"]
};

export type RefMap = Record<string, MappedComponent[]>;

export type MapResult = {
  map: RefMap;
  mjml: string; // Tagged
  refs: string[]; // Top-level refs
};

/**
 * Parse MJML, extract component map, return tagged output.
 */
export const mapRefs = (input: string): MapResult => {
  const map: RefMap = {};
  const { mjml, refs } = processLevel(input, map);
  return { map, mjml, refs };
};

const processLevel = (input: string, map: RefMap): { mjml: string; refs: string[] } => {
  const blocks = extractBlocks(input);
  if (!blocks.length) return { mjml: input, refs: [] };

  let result = '';
  let lastEnd = 0;
  const refs: string[] = [];

  for (const { slug, content, start, end } of blocks) {
    result += input.slice(lastEnd, start);

    const nested = processLevel(content, map);
    const cleaned = cleanRefs(nested.mjml);

    if (!map[slug]) map[slug] = [];
    let idx = map[slug].findIndex((c) => c.mjml === cleaned);
    if (idx === -1) {
      idx = map[slug].length;
      map[slug].push({ mjml: cleaned, refs: nested.refs });
    }

    const ref = `${slug}:${idx}`;
    result += `{{#component:${ref}}}${nested.mjml}{{/component:${ref}}}`;
    refs.push(ref);
    lastEnd = end;
  }

  result += input.slice(lastEnd);
  return { mjml: result, refs };
};

type Block = { slug: string; content: string; start: number; end: number };

const extractBlocks = (input: string): Block[] => {
  const blocks: Block[] = [];
  OPEN_TAG.lastIndex = 0;

  let match;
  while ((match = OPEN_TAG.exec(input)) !== null) {
    const slug = match[1];
    const start = match.index;
    const openEnd = start + match[0].length;

    const closeIdx = findClose(input, slug, openEnd);
    if (closeIdx === -1) continue;

    const end = closeIdx + `{{/component:${slug}}}`.length;
    blocks.push({ slug, content: input.slice(openEnd, closeIdx).trim(), start, end });
    OPEN_TAG.lastIndex = end;
  }

  return blocks;
};

const findClose = (input: string, slug: string, from: number): number => {
  const open = new RegExp(`\\{\\{#component:${slug}\\}\\}`, 'g');
  const close = new RegExp(`\\{\\{/component:${slug}\\}\\}`, 'g');
  const pos: { p: number; o: boolean }[] = [];

  open.lastIndex = from;
  close.lastIndex = from;

  let m;
  while ((m = open.exec(input))) pos.push({ p: m.index, o: true });
  while ((m = close.exec(input))) pos.push({ p: m.index, o: false });
  pos.sort((a, b) => a.p - b.p);

  let depth = 1;
  for (const { p, o } of pos) {
    depth += o ? 1 : -1;
    if (depth === 0) return p;
  }
  return -1;
};

/**
 * {{#component:slug:N}}...{{/component:slug:N}} → {{#component:slug:N}}{{/component:slug:N}}
 */
const cleanRefs = (content: string): string =>
  content.replace(
    /\{\{#component:([a-z0-9-]+:\d+)\}\}[\s\S]*?\{\{\/component:\1\}\}/g,
    '{{#component:$1}}{{/component:$1}}',
  );
