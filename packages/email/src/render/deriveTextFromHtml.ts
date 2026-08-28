/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
const TAG_BODY = `[^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*`;
const DROPPED_SECTIONS = new RegExp(`<(head|style|script)\\b${TAG_BODY}>[\\s\\S]*?</\\1\\s*>`, 'gi');
const LINE_BREAKS = /<br\s*\/?>/gi;
const IMAGES = new RegExp(`<img\\b(${TAG_BODY})/?>`, 'gi');
const BLOCK_CLOSERS = /<\/(p|div|tr|td|th|table|h[1-6]|li|ul|ol|section|article|header|footer|blockquote)\s*>/gi;
const LINKS = new RegExp(`<a\\b(${TAG_BODY})>([\\s\\S]*?)</a\\s*>`, 'gi');
const TAGS = new RegExp(`<!--[\\s\\S]*?-->|<!doctype${TAG_BODY}>|</?[a-zA-Z]${TAG_BODY}>`, 'gi');
const HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;
const ALT = /(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

const fromCodePointSafe = (code: number): string | null => {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return null;
  return String.fromCodePoint(code);
};

const attributeValue = (pattern: RegExp, attributes: string): string => {
  const match = pattern.exec(attributes);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
};

// `&amp;` decodes LAST and named lookup skips it, so double-encoded input (`&amp;#169;`) yields the
// literal `&#169;` the HTML displays, never a second decode pass.
const decodeEntities = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => fromCodePointSafe(Number.parseInt(hex, 16)) ?? match)
    .replace(/&#(\d+);/g, (match, decimal: string) => fromCodePointSafe(Number(decimal)) ?? match)
    .replace(/&([a-z]+);/gi, (match, name: string) =>
      name.toLowerCase() === 'amp' ? match : (NAMED_ENTITIES[name.toLowerCase()] ?? match),
    )
    .replace(/&amp;/gi, '&');

const renderLink = (attributes: string, label: string): string => {
  const href = attributeValue(HREF, attributes);
  const text = label.replace(BLOCK_CLOSERS, '\n').replace(TAGS, '').replace(/[ \t]+/g, ' ').trim();
  if (!text) return href;
  if (text === href) return text;
  return href ? `${text} (${href})` : text;
};

export const deriveTextFromHtml = (html: string): string =>
  decodeEntities(
    html
      .replace(DROPPED_SECTIONS, '')
      .replace(LINE_BREAKS, '\n')
      .replace(IMAGES, (_match, attributes: string) => attributeValue(ALT, attributes))
      .replace(LINKS, (_match, attributes: string, label: string) => renderLink(attributes, label))
      .replace(BLOCK_CLOSERS, '\n')
      .replace(TAGS, ''),
  )
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
