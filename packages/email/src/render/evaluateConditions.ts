/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import { type Branch, IF, parseIfBlock } from '@template/email/render/conditionParser';
import type { Variables } from '@template/email/render/interpolate';
import { isLocal, isTest } from '@template/shared/utils';

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

// A malformed/uncheckable rule is surfaced (with its body) in local/test for visibility, and
// fails closed in production — the same behavior the single-block evaluator had.
const onRuleError = (message: string, body: string, data: Record<string, unknown>): string | null =>
  isLocal || isTest ? `<!-- RULE ERROR: ${message} -->\n${renderConditions(body, data)}` : null;

// Render the first branch whose rule matches (recursing for nested blocks); bare `{{else}}` is the
// fallback; nothing if no branch matches and there is no else.
const renderBranches = (branches: Branch[], data: Record<string, unknown>): string => {
  for (const branch of branches) {
    if (branch.kind === 'else') return renderConditions(branch.body, data);

    if (branch.ruleError !== undefined) {
      const rendered = onRuleError(branch.ruleError, branch.body, data);
      if (rendered !== null) return rendered;
      continue;
    }

    try {
      if (check(branch.rule!, data) === true) return renderConditions(branch.body, data);
    } catch (err) {
      const rendered = onRuleError(err instanceof Error ? err.message : 'Unknown error', branch.body, data);
      if (rendered !== null) return rendered;
    }
  }
  return '';
};

function renderConditions(content: string, data: Record<string, unknown>): string {
  let result = '';
  let i = 0;
  while (i < content.length) {
    const openIdx = content.indexOf(IF, i);
    if (openIdx === -1) {
      result += content.slice(i);
      break;
    }
    result += content.slice(i, openIdx);
    const block = parseIfBlock(content, openIdx);
    if (!block) {
      result += content.slice(openIdx); // unterminated — pass the rest through unchanged
      break;
    }
    result += renderBranches(block.branches, data);
    i = block.end;
  }
  return result;
}

export const evaluateConditions = (content: string, variables: Variables): string =>
  renderConditions(content, flattenVariables(variables));
