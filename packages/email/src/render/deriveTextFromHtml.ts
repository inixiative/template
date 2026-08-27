/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
const DROPPED_SECTIONS = /<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const LINE_BREAKS = /<br\s*\/?>/gi;
const BLOCK_CLOSERS = /<\/(p|div|tr|table|h[1-6]|li|ul|ol|section|article|header|footer|blockquote)>/gi;
const LINKS = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TAGS = /<[^>]+>/g;

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');

const renderLink = (href: string, label: string): string => {
  const text = label.replace(TAGS, '').replace(/\s+/g, ' ').trim();
  if (!text) return href.trim();
  if (text === href.trim()) return text;
  return `${text} (${href.trim()})`;
};

export const deriveTextFromHtml = (html: string): string =>
  decodeEntities(
    html
      .replace(DROPPED_SECTIONS, '')
      .replace(LINE_BREAKS, '\n')
      .replace(LINKS, (_match, href: string, label: string) => renderLink(href, label))
      .replace(BLOCK_CLOSERS, '\n')
      .replace(TAGS, ''),
  )
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
