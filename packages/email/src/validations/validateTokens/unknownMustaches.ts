/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { componentTagPattern } from '@template/email/render/blockTags';
import { EACH, ELSE, ELSE_IF, END, END_EACH, IF, TOKEN_PATTERN } from '@template/email/render/conditionParser';

const MARKERS = [IF, ELSE_IF, ELSE, END, EACH, END_EACH];

const startsKnownConstruct = (content: string, at: number): boolean => {
  if (MARKERS.some((marker) => content.startsWith(marker, at))) return true;
  const block = componentTagPattern();
  block.lastIndex = at;
  const blockMatch = block.exec(content);
  if (blockMatch && blockMatch.index === at) return true;
  const token = new RegExp(TOKEN_PATTERN.source, 'g');
  token.lastIndex = at;
  const tokenMatch = token.exec(content);
  return !!tokenMatch && tokenMatch.index === at;
};

/** Offsets of every `{{` that opens nothing the engine understands — text that would ship as written. */
export const unknownMustaches = (content: string): number[] => {
  const out: number[] = [];
  let at = content.indexOf('{{');
  while (at !== -1) {
    if (!startsKnownConstruct(content, at)) out.push(at);
    at = content.indexOf('{{', at + 2);
  }
  return out;
};
