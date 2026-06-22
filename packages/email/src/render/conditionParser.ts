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
