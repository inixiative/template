/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { bareWordAt } from '@template/email/render/conditionParser/bareWordAt';
import { skipWhitespace } from '@template/email/render/conditionParser/skipWhitespace';

export type MarkerAttributeStep =
  | { kind: 'end'; end: number }
  | { kind: 'malformed'; value: string; next: number }
  | { kind: 'attribute'; name: string; valueStart: number };

export const nextMarkerAttribute = (content: string, start: number): MarkerAttributeStep | null => {
  const cursor = skipWhitespace(content, start);
  if (content.slice(cursor, cursor + 2) === '}}') return { kind: 'end', end: cursor + 2 };
  if (cursor >= content.length) return null;

  const nextBrace = content.indexOf('}}', cursor);
  if (nextBrace === -1) return null;
  const eq = content.indexOf('=', cursor);
  const whitespaceOffset = content.slice(cursor, nextBrace).search(/\s/);
  const nextWhitespace = whitespaceOffset === -1 ? -1 : cursor + whitespaceOffset;
  if (
    eq === -1 ||
    eq > nextBrace ||
    (nextWhitespace !== -1 && nextWhitespace < eq) ||
    eq === cursor
  ) {
    const { value, next } = bareWordAt(content, cursor);
    return { kind: 'malformed', value, next };
  }

  return { kind: 'attribute', name: content.slice(cursor, eq).trim(), valueStart: eq + 1 };
};
