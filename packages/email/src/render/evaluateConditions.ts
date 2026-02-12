/**
 * Evaluate {{#if rule={...}}}...{{/if}} conditional blocks in MJML.
 */

import { type Condition, check } from '@inixiative/json-rules';
import { isDev, isLocal, isTest } from '@template/shared/utils';
import type { Variables } from '@template/email/render/interpolate';

/**
 * Flatten variables into dot-notation accessible object for json-rules.
 * { sender: { name: 'Acme' } } → { 'sender.name': 'Acme' }
 */
const flattenVariables = (variables: Variables): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [prefix, values] of Object.entries(variables)) {
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      result[`${prefix}.${key}`] = value;
    }
  }

  return result;
};

/**
 * Find matching close brace, handling nested braces and strings.
 */
const findJsonEnd = (str: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    switch (ch) {
      case '{':
        depth++;
        break;
      case '}':
        depth--;
        if (depth === 0) return i;
        break;
    }
  }
  return -1;
};

/**
 * Parse and evaluate all conditional blocks.
 * {{#if rule={...}}}content{{/if}}
 *
 * NOTE: Nested conditionals are NOT supported - use compound rules (all/any) instead.
 */
export const evaluateConditions = (content: string, variables: Variables): string => {
  const data = flattenVariables(variables);
  const OPEN = '{{#if rule=';
  const CLOSE = '{{/if}}';

  let result = '';
  let pos = 0;

  while (pos < content.length) {
    const openIdx = content.indexOf(OPEN, pos);
    if (openIdx === -1) {
      result += content.slice(pos);
      break;
    }

    result += content.slice(pos, openIdx);

    const jsonStart = openIdx + OPEN.length;
    const jsonEnd = findJsonEnd(content, jsonStart);
    if (jsonEnd === -1) {
      result += content.slice(openIdx);
      break;
    }

    const ruleJson = content.slice(jsonStart, jsonEnd + 1);
    const afterJson = jsonEnd + 1;

    // Expect }} after JSON
    if (content.slice(afterJson, afterJson + 2) !== '}}') {
      result += content.slice(openIdx, afterJson);
      pos = afterJson;
      continue;
    }

    const contentStart = afterJson + 2;
    const closeIdx = content.indexOf(CLOSE, contentStart);
    if (closeIdx === -1) {
      result += content.slice(openIdx);
      break;
    }

    const innerContent = content.slice(contentStart, closeIdx);
    pos = closeIdx + CLOSE.length;

    try {
      const rule: Condition = JSON.parse(ruleJson);
      const matches = check(rule, data);
      if (matches === true) {
        result += innerContent;
      }
    } catch (err) {
      if (isLocal || isTest || isDev) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result += `<!-- RULE ERROR: ${msg} -->\n${innerContent}`;
      }
    }
  }

  return result;
};
