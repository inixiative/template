/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { bareWordAt } from '@template/email/render/conditionParser/bareWordAt';
import { findJsonEnd } from '@template/email/render/conditionParser/findJsonEnd';
import { EACH } from '@template/email/render/conditionParser/grammar';
import { nextMarkerAttribute } from '@template/email/render/conditionParser/nextMarkerAttribute';
import { parseRuleJson } from '@template/email/render/conditionParser/parseRuleJson';
import { skipWhitespace } from '@template/email/render/conditionParser/skipWhitespace';
import type { EachBlock } from '@template/email/render/conditionParser/types';

export type EachMarker = Omit<EachBlock, 'body' | 'end'> & { next: number };

export const eachMarkerAt = (content: string, i: number): EachMarker | null => {
  let cursor = skipWhitespace(content, i + EACH.length);
  const { value: path, next: afterPath } = bareWordAt(content, cursor);
  if (!path) return null;
  cursor = afterPath;

  let as: string | undefined;
  let index: string | undefined;
  let filter: Condition | undefined;
  let filterError: string | undefined;
  const seenAttributes = new Set<string>();
  const attributeErrors: string[] = [];

  while (true) {
    const step = nextMarkerAttribute(content, cursor);
    if (!step) return null;
    if (step.kind === 'end') {
      return {
        path,
        as,
        asMissing: as === undefined,
        index,
        filter,
        filterError,
        attributeErrors: attributeErrors.length > 0 ? attributeErrors : undefined,
        next: step.end,
      };
    }
    if (step.kind === 'malformed') {
      attributeErrors.push(
        `malformed attribute "${step.value}" on {{#each}} block (expected name=value)`,
      );
      cursor = step.next;
      continue;
    }

    const { name: attrName, valueStart } = step;
    if (seenAttributes.has(attrName))
      attributeErrors.push(`duplicate ${attrName}= attribute on {{#each}} block`);
    seenAttributes.add(attrName);
    if (attrName !== 'as' && attrName !== 'index' && attrName !== 'filter') {
      attributeErrors.push(`unknown ${attrName}= attribute on {{#each}} block`);
    }

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
        ({ rule: filter, ruleError: filterError } = parseRuleJson(
          content.slice(valueStart, braceEnd + 1),
        ));
        cursor = braceEnd + 1;
        continue;
      }
      const { value, next } = bareWordAt(content, valueStart);
      filterError = `filter must be a JSON object, got "${value}"`;
      cursor = next;
      continue;
    }

    const { value, next } = bareWordAt(content, valueStart);
    if (attrName === 'as') as = value;
    else if (attrName === 'index') index = value;
    cursor = next;
  }
};
