/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { bareWordAt } from '@template/email/render/conditionParser/bareWordAt';
import { findJsonEnd } from '@template/email/render/conditionParser/findJsonEnd';
import { DATETIME, TOKEN_PATH_PATTERN } from '@template/email/render/conditionParser/grammar';
import { nextMarkerAttribute } from '@template/email/render/conditionParser/nextMarkerAttribute';
import { skipWhitespace } from '@template/email/render/conditionParser/skipWhitespace';
import { isPlainObject } from 'lodash-es';

export type DatetimeTarget =
  | { kind: 'path'; path: string }
  | { kind: 'now' }
  | { kind: 'literal'; value: string }
  | { kind: 'expr'; expr: Record<string, unknown> };

export type DatetimeToken = {
  start: number;
  end: number;
  raw: string;
  target?: DatetimeTarget;
  offset?: Record<string, unknown>;
  format?: string;
  timeZone?: string;
  errors?: string[];
};

const quotedStringAt = (
  content: string,
  start: number,
): { value?: string; error?: string; next: number } | null => {
  let i = start + 1;
  let inEscape = false;
  while (i < content.length) {
    const ch = content[i];
    if (inEscape) {
      inEscape = false;
      i++;
      continue;
    }
    if (ch === '\\') {
      inEscape = true;
      i++;
      continue;
    }
    if (ch === '"') {
      try {
        return { value: JSON.parse(content.slice(start, i + 1)) as string, next: i + 1 };
      } catch (err) {
        return { error: (err as SyntaxError).message, next: i + 1 };
      }
    }
    i++;
  }
  return null;
};

const consumeUnseparatedTrailingText = (
  content: string,
  cursor: number,
  label: string,
  errors: string[],
): number => {
  const { value, next } = bareWordAt(content, cursor);
  if (!value) return cursor;
  errors.push(`has unexpected "${value}" immediately after ${label}`);
  return next;
};

const readJsonObject = (
  content: string,
  start: number,
  label: string,
  errors: string[],
): { value?: Record<string, unknown>; next: number } | null => {
  const braceEnd = findJsonEnd(content, start);
  if (braceEnd === -1) {
    const close = content.indexOf('}}', start);
    if (close === -1) return null;
    errors.push(`${label} JSON never closes`);
    return { next: close };
  }
  let value: Record<string, unknown> | undefined;
  try {
    const parsed = JSON.parse(content.slice(start, braceEnd + 1)) as unknown;
    if (!isPlainObject(parsed)) errors.push(`${label} must be a JSON object`);
    else value = parsed as Record<string, unknown>;
  } catch (err) {
    errors.push(`has invalid ${label} JSON: ${(err as SyntaxError).message}`);
  }
  return {
    value,
    next: consumeUnseparatedTrailingText(content, braceEnd + 1, label, errors),
  };
};

const readQuotedString = (
  content: string,
  start: number,
  label: string,
  errors: string[],
): { value?: string; next: number } | null => {
  const parsed = quotedStringAt(content, start);
  if (!parsed) {
    const close = content.indexOf('}}', start);
    if (close === -1) return null;
    errors.push(`${label} never closes`);
    return { next: close };
  }
  if (parsed.error) errors.push(`has invalid ${label}: ${parsed.error}`);
  return {
    value: parsed.value,
    next: consumeUnseparatedTrailingText(content, parsed.next, label, errors),
  };
};

const skipUnknownAttributeValue = (content: string, valueStart: number): number | null => {
  if (content[valueStart] === '{') {
    const braceEnd = findJsonEnd(content, valueStart);
    if (braceEnd !== -1) return braceEnd + 1;
    const close = content.indexOf('}}', valueStart);
    return close === -1 ? null : close;
  }
  if (content[valueStart] === '"') {
    const quoted = quotedStringAt(content, valueStart);
    if (quoted) return quoted.next;
    const close = content.indexOf('}}', valueStart);
    return close === -1 ? null : close;
  }
  return bareWordAt(content, valueStart).next;
};

export const datetimeTokenAt = (content: string, start: number): DatetimeToken | null => {
  if (!content.startsWith(DATETIME, start)) return null;

  let cursor = skipWhitespace(content, start + DATETIME.length);
  if (cursor >= content.length) return null;

  const errors: string[] = [];
  let target: DatetimeTarget | undefined;

  if (content.slice(cursor, cursor + 2) === '}}') {
    errors.push('is missing a target');
  } else if (content[cursor] === '{') {
    const parsed = readJsonObject(content, cursor, 'date expression', errors);
    if (!parsed) return null;
    if (parsed.value) target = { kind: 'expr', expr: parsed.value };
    cursor = parsed.next;
  } else if (content[cursor] === '"') {
    const parsed = readQuotedString(content, cursor, 'date literal', errors);
    if (!parsed) return null;
    if (parsed.value !== undefined) target = { kind: 'literal', value: parsed.value };
    cursor = parsed.next;
  } else {
    const { value: word, next } = bareWordAt(content, cursor);
    if (word === 'now') {
      target = { kind: 'now' };
      cursor = next;
    } else if (TOKEN_PATH_PATTERN.test(word)) {
      target = { kind: 'path', path: word };
      cursor = next;
    } else if (word.includes('=')) {
      errors.push('is missing a target');
    } else {
      errors.push(`has an invalid target: ${word}`);
      cursor = next;
    }
  }

  let offset: Record<string, unknown> | undefined;
  let format: string | undefined;
  let timeZone: string | undefined;
  const seenAttributes = new Set<string>();

  while (true) {
    const step = nextMarkerAttribute(content, cursor);
    if (!step) return null;
    if (step.kind === 'end') {
      return {
        start,
        end: step.end,
        raw: content.slice(start, step.end),
        target,
        offset,
        format,
        timeZone,
        errors: errors.length > 0 ? errors : undefined,
      };
    }
    if (step.kind === 'malformed') {
      errors.push(`has malformed attribute "${step.value}" (expected name=value)`);
      cursor = step.next;
      continue;
    }

    const { name: attributeName, valueStart } = step;
    const isDuplicate = seenAttributes.has(attributeName);
    if (isDuplicate) errors.push(`has duplicate ${attributeName}= attribute`);
    seenAttributes.add(attributeName);

    if (attributeName === 'format') {
      if (content[valueStart] !== '"') {
        const { value, next } = bareWordAt(content, valueStart);
        errors.push(`format= must be a double-quoted string, got "${value}"`);
        cursor = next;
        continue;
      }
      const parsed = readQuotedString(content, valueStart, 'format= string', errors);
      if (!parsed) return null;
      if (!isDuplicate && parsed.value !== undefined) format = parsed.value;
      cursor = parsed.next;
      continue;
    }

    if (attributeName === 'offset') {
      if (content[valueStart] !== '{') {
        const { value, next } = bareWordAt(content, valueStart);
        errors.push(`offset= must be a JSON object, got "${value}"`);
        cursor = next;
        continue;
      }
      const parsed = readJsonObject(content, valueStart, 'offset=', errors);
      if (!parsed) return null;
      if (!isDuplicate && parsed.value !== undefined) offset = parsed.value;
      cursor = parsed.next;
      continue;
    }

    if (attributeName === 'tz') {
      const { value, next } = bareWordAt(content, valueStart);
      if (!value) errors.push('tz= attribute is missing a value');
      else if (!isDuplicate) timeZone = value;
      cursor = next;
      continue;
    }

    errors.push(`has unknown ${attributeName}= attribute`);
    const afterUnknown = skipUnknownAttributeValue(content, valueStart);
    if (afterUnknown === null) return null;
    cursor = afterUnknown;
  }
};

export const datetimeTokensIn = (text: string): DatetimeToken[] => {
  const tokens: DatetimeToken[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const at = text.indexOf(DATETIME, searchFrom);
    if (at === -1) break;
    const token = datetimeTokenAt(text, at);
    if (token) {
      tokens.push(token);
      searchFrom = token.end;
    } else {
      searchFrom = at + DATETIME.length;
    }
  }
  return tokens;
};
