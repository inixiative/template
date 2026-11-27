/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { componentTagPattern } from '@template/email/render/blockTags';
import {
  datetimeTokenAt,
  EACH,
  ELSE,
  ELSE_IF,
  END,
  END_EACH,
  IF,
  TOKEN_PATTERN,
} from '@template/email/render/conditionParser';

const MARKERS = [IF, ELSE_IF, ELSE, END, EACH, END_EACH];

const startsKnownConstruct = (content: string, at: number): boolean => {
  if (MARKERS.some((marker) => content.startsWith(marker, at))) return true;
  const block = componentTagPattern();
  block.lastIndex = at;
  const blockMatch = block.exec(content);
  if (blockMatch && blockMatch.index === at) return true;
  const token = new RegExp(TOKEN_PATTERN.source, 'g');
  token.lastIndex = at;
  return token.exec(content)?.index === at;
};

/** Offsets of every `{{` that opens nothing the engine understands — text that would ship as written. */
export const offsetsOfUnrecognizedMustaches = (content: string): number[] => {
  const out: number[] = [];
  let at = content.indexOf('{{');
  while (at !== -1) {
    const datetime = datetimeTokenAt(content, at);
    if (datetime) {
      at = content.indexOf('{{', datetime.end);
      continue;
    }
    if (!startsKnownConstruct(content, at)) out.push(at);
    at = content.indexOf('{{', at + 2);
  }
  return out;
};
