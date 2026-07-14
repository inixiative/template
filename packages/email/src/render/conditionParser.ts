/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';

// Conditional block syntax (Handlebars-flavored, json-rules predicates):
//   {{#if rule=<Condition JSON>}} … {{else if rule=<Condition JSON>}} … {{else}} … {{/if}}
export const IF = '{{#if rule=';
export const ELSE_IF = '{{else if rule=';
export const ELSE = '{{else}}';
export const END = '{{/if}}';

export type Branch = {
  kind: 'if' | 'elseIf' | 'else';
  rule?: Condition; // present for if/elseIf when the embedded JSON parsed
  ruleError?: string; // present for if/elseIf when the embedded JSON was invalid
  body: string;
};

export type IfBlock = { branches: Branch[]; end: number }; // `end` = index just past {{/if}}

// Index of the `}` that balances the JSON object starting at `start` (`str[start] === '{'`),
// string-aware so braces inside string values don't count. -1 if unbalanced.
export const findJsonEnd = (str: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let inEscape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inEscape) {
      inEscape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      inEscape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

type RuleMarker = { rule?: Condition; ruleError?: string; next: number };

// Read a rule-bearing marker (IF / ELSE_IF) whose token starts at `i`. The value is any JSON
// Condition: an object `{…}` (brace-matched, string-aware) or a bare literal like `true`/`false`
// (a valid Condition with no braces — fall back to the marker's closing `}}`). Markers are tight:
// `}}` immediately follows the value (no padding), matching the interpolation syntax. Returns the
// parsed rule (or a parse error) and the index past `}}`, or null if there is no closing `}}`.
const readRuleMarker = (content: string, i: number, token: string): RuleMarker | null => {
  const jsonStart = i + token.length;

  let valueEnd: number;
  if (content[jsonStart] === '{') {
    const braceEnd = findJsonEnd(content, jsonStart);
    if (braceEnd === -1) return null;
    valueEnd = braceEnd + 1;
  } else {
    const close = content.indexOf('}}', jsonStart);
    if (close === -1) return null;
    valueEnd = close;
  }
  if (content.slice(valueEnd, valueEnd + 2) !== '}}') return null;

  const next = valueEnd + 2;
  try {
    return { rule: JSON.parse(content.slice(jsonStart, valueEnd)) as Condition, next };
  } catch (err) {
    return { ruleError: err instanceof Error ? err.message : 'invalid JSON', next };
  }
};

// Parse the {{#if}} … {{/if}} block whose opening IF marker begins at `openIdx`, splitting it on
// its top-level {{else if}} / {{else}} separators. Depth-aware: nested blocks are skipped (their
// separators belong to them) and contribute to the enclosing branch's body. Returns null if the
// opening marker is malformed or there is no matching {{/if}}.
export const parseIfBlock = (content: string, openIdx: number): IfBlock | null => {
  const open = readRuleMarker(content, openIdx, IF);
  if (!open) return null;

  const branches: Branch[] = [];
  let current: { kind: Branch['kind']; rule?: Condition; ruleError?: string; bodyStart: number } = {
    kind: 'if',
    rule: open.rule,
    ruleError: open.ruleError,
    bodyStart: open.next,
  };
  const closeCurrent = (bodyEnd: number) =>
    branches.push({
      kind: current.kind,
      rule: current.rule,
      ruleError: current.ruleError,
      body: content.slice(current.bodyStart, bodyEnd),
    });

  let depth = 1;
  let i = open.next;
  while (i < content.length) {
    if (content.startsWith(IF, i)) {
      const nested = readRuleMarker(content, i, IF);
      if (nested) {
        depth++;
        i = nested.next;
        continue;
      }
      i += IF.length; // malformed nested open — skip the token, don't char-walk into it
      continue;
    }
    if (content.startsWith(END, i)) {
      depth--;
      if (depth === 0) {
        closeCurrent(i);
        return { branches, end: i + END.length };
      }
      i += END.length;
      continue;
    }
    if (content.startsWith(ELSE_IF, i)) {
      const m = readRuleMarker(content, i, ELSE_IF);
      if (m) {
        if (depth === 1) {
          closeCurrent(i);
          current = { kind: 'elseIf', rule: m.rule, ruleError: m.ruleError, bodyStart: m.next };
        }
        i = m.next;
        continue;
      }
      i += ELSE_IF.length; // malformed else-if — skip the token
      continue;
    }
    if (content.startsWith(ELSE, i)) {
      if (depth === 1) {
        closeCurrent(i);
        current = { kind: 'else', bodyStart: i + ELSE.length };
      }
      i += ELSE.length;
      continue;
    }
    i++;
  }
  return null; // no matching {{/if}}
};

export const EACH = '{{#each ';
export const END_EACH = '{{/each}}';

export const RESERVED_SCOPE_ROOTS: ReadonlySet<string> = new Set(['sender', 'recipient', 'data', 'system']);

const GRAMMAR_KEYWORDS = ['else', 'if', 'each', 'as', 'index', 'rule', 'filter'] as const;

export const RESERVED_BINDING_NAMES: ReadonlySet<string> = new Set([...RESERVED_SCOPE_ROOTS, ...GRAMMAR_KEYWORDS]);

export const isValidBindingIdentifier = (value: string): boolean => /^[a-z][a-z0-9-]*$/.test(value);

export type EachBlock = {
  path: string;
  as?: string;
  asMissing?: boolean;
  index?: string;
  filter?: Condition;
  filterError?: string;
  attributeErrors?: string[];
  body: string;
  end: number;
};

const skipWhitespace = (content: string, i: number): number => {
  let next = i;
  while (/\s/.test(content[next] ?? '')) next++;
  return next;
};

const readBareWord = (content: string, i: number): { value: string; next: number } => {
  let next = i;
  while (next < content.length && !/\s/.test(content[next] ?? '') && content.slice(next, next + 2) !== '}}') next++;
  return { value: content.slice(i, next), next };
};

type EachMarker = Omit<EachBlock, 'body' | 'end'> & { next: number };

const readEachMarker = (content: string, i: number): EachMarker | null => {
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
        try {
          filter = JSON.parse(content.slice(valueStart, braceEnd + 1)) as Condition;
        } catch (err) {
          filterError = err instanceof Error ? err.message : 'invalid JSON';
        }
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

type Kind = 'if' | 'each';

const nextStructuralToken = (content: string, i: number): { kind: Kind; isClose: boolean; index: number } | null => {
  for (let j = i; j < content.length; j++) {
    if (content.startsWith(EACH, j)) return { kind: 'each', isClose: false, index: j };
    if (content.startsWith(END_EACH, j)) return { kind: 'each', isClose: true, index: j };
    if (content.startsWith(END, j)) return { kind: 'if', isClose: true, index: j };
    if (content.startsWith(IF, j) && readRuleMarker(content, j, IF)) return { kind: 'if', isClose: false, index: j };
    if (content.startsWith(ELSE_IF, j)) {
      const marker = readRuleMarker(content, j, ELSE_IF);
      if (marker) j = marker.next - 1;
    }
  }
  return null;
};

const findEachBodyEnd = (content: string, bodyStart: number): number => {
  const stack: Kind[] = ['each'];
  let i = bodyStart;

  while (stack.length > 0) {
    const token = nextStructuralToken(content, i);
    if (!token) return -1;

    if (!token.isClose) {
      stack.push(token.kind);
      if (token.kind === 'if') {
        const marker = readRuleMarker(content, token.index, IF);
        i = marker ? marker.next : token.index + IF.length;
      } else {
        const marker = readEachMarker(content, token.index);
        if (!marker) return -1;
        i = marker.next;
      }
      continue;
    }

    if (stack.at(-1) !== token.kind) return -1;
    stack.pop();
    i = token.index + (token.kind === 'if' ? END.length : END_EACH.length);
    if (stack.length === 0) return i;
  }

  return i;
};

export const parseEachBlock = (content: string, openIdx: number): EachBlock | null => {
  const marker = readEachMarker(content, openIdx);
  if (!marker) return null;

  const bodyEnd = findEachBodyEnd(content, marker.next);
  if (bodyEnd === -1) return null;

  return {
    path: marker.path,
    as: marker.as,
    asMissing: marker.asMissing,
    index: marker.index,
    filter: marker.filter,
    filterError: marker.filterError,
    attributeErrors: marker.attributeErrors,
    body: content.slice(marker.next, bodyEnd - END_EACH.length),
    end: bodyEnd,
  };
};

export const isStructurallyBalanced = (text: string): boolean => {
  const stack: Kind[] = [];
  let i = 0;

  while (true) {
    const token = nextStructuralToken(text, i);
    if (!token) return stack.length === 0;

    if (!token.isClose) {
      stack.push(token.kind);
      if (token.kind === 'if') {
        const marker = readRuleMarker(text, token.index, IF);
        i = marker ? marker.next : token.index + IF.length;
      } else {
        const marker = readEachMarker(text, token.index);
        if (!marker) return false;
        i = marker.next;
      }
      continue;
    }

    const top = stack.at(-1);
    if (top !== token.kind) return false;
    stack.pop();
    i = token.index + (token.kind === 'if' ? END.length : END_EACH.length);
  }
};
