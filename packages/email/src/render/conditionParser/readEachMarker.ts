/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { findJsonEnd } from '@template/email/render/conditionParser/findJsonEnd';
import { EACH } from '@template/email/render/conditionParser/grammar';
import { parseRuleJson } from '@template/email/render/conditionParser/parseRuleJson';
import { readBareWord } from '@template/email/render/conditionParser/readBareWord';
import { skipWhitespace } from '@template/email/render/conditionParser/skipWhitespace';
import type { EachBlock } from '@template/email/render/conditionParser/types';

export type EachMarker = Omit<EachBlock, 'body' | 'end'> & { next: number };

export const readEachMarker = (content: string, i: number): EachMarker | null => {
  let cursor = skipWhitespace(content, i + EACH.length);
  const { value: path, next: afterPath } = readBareWord(content, cursor);
  if (!path) return null;
  cursor = afterPath;

  let as: string | undefined;
  let index: string | undefined;
  let filter: Condition | undefined;
  let filterError: string | undefined;
  const seenAttributes = new Set<string>();
  const attributeErrors: string[] = [];

  while (true) {
    cursor = skipWhitespace(content, cursor);
    if (content.slice(cursor, cursor + 2) === '}}') {
      return {
        path,
        as,
        asMissing: as === undefined,
        index,
        filter,
        filterError,
        attributeErrors: attributeErrors.length > 0 ? attributeErrors : undefined,
        next: cursor + 2,
      };
    }
    if (cursor >= content.length) return null;

    const nextBrace = content.indexOf('}}', cursor);
    if (nextBrace === -1) return null;
    const eq = content.indexOf('=', cursor);
    const whitespaceOffset = content.slice(cursor, nextBrace).search(/\s/);
    const nextWhitespace = whitespaceOffset === -1 ? -1 : cursor + whitespaceOffset;
    if (eq === -1 || eq > nextBrace || (nextWhitespace !== -1 && nextWhitespace < eq) || eq === cursor) {
      const { value, next } = readBareWord(content, cursor);
      attributeErrors.push(`malformed attribute "${value}" on {{#each}} block (expected name=value)`);
      cursor = next;
      continue;
    }
    const attrName = content.slice(cursor, eq).trim();
    if (seenAttributes.has(attrName)) attributeErrors.push(`duplicate ${attrName}= attribute on {{#each}} block`);
    seenAttributes.add(attrName);
    if (attrName !== 'as' && attrName !== 'index' && attrName !== 'filter') {
      attributeErrors.push(`unknown ${attrName}= attribute on {{#each}} block`);
    }

    const valueStart = eq + 1;
    if (attrName === 'filter') {
      if (content[valueStart] === '{') {
        const braceEnd = findJsonEnd(content, valueStart);
        if (braceEnd === -1) {
          const close = content.indexOf('}}', valueStart);
          if (close === -1) return null;
          filterError = 'filter JSON never closes';
          cursor = close;
          continue;
        }
        ({ rule: filter, ruleError: filterError } = parseRuleJson(content.slice(valueStart, braceEnd + 1)));
        cursor = braceEnd + 1;
        continue;
      }
      const { value, next } = readBareWord(content, valueStart);
      filterError = `filter must be a JSON object, got "${value}"`;
      cursor = next;
      continue;
    }

    const { value, next } = readBareWord(content, valueStart);
    if (attrName === 'as') as = value;
    else if (attrName === 'index') index = value;
    cursor = next;
  }
};
