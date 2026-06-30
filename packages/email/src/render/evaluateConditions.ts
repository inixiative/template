/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import { type Branch, IF, parseIfBlock } from '@template/email/render/conditionParser';
import type { Variables } from '@template/email/render/interpolate';

// Notified once per render-time rule throw (malformed/uncheckable rule). The caller decides what to
// do with it (log it, apply the template's error policy) — the evaluator stays free of those concerns.
export type RuleErrorSink = (message: string) => void;

// Debug override: emit the offending block inline (HTML comment + body) so a broken template is
// visible in a rendered preview. Off by default and independent of ENVIRONMENT — the error still
// reaches `onError` regardless. Read at call time so a test can toggle it without import ordering.
const inlineRenderErrors = (): boolean => process.env.EMAIL_INLINE_RENDER_ERRORS === 'true';

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

// A malformed/uncheckable rule is always reported via `onError`. With the inline-debug flag on it is
// also surfaced (with its body) in the output; otherwise the branch is skipped (the next branch is
// tried, degrading the block) — the signal lives in `onError`, not the rendered bytes.
const onRuleError = (
  message: string,
  body: string,
  data: Record<string, unknown>,
  onError?: RuleErrorSink,
): string | null => {
  onError?.(message);
  return inlineRenderErrors() ? `<!-- RULE ERROR: ${message} -->\n${renderConditions(body, data, onError)}` : null;
};

// Render the first branch whose rule matches (recursing for nested blocks); bare `{{else}}` is the
// fallback; nothing if no branch matches and there is no else.
const renderBranches = (branches: Branch[], data: Record<string, unknown>, onError?: RuleErrorSink): string => {
  for (const branch of branches) {
    if (branch.kind === 'else') return renderConditions(branch.body, data, onError);

    if (branch.ruleError !== undefined) {
      const rendered = onRuleError(branch.ruleError, branch.body, data, onError);
      if (rendered !== null) return rendered;
      continue;
    }

    // `check` returns `true` on match, or a string explaining the mismatch (a *reason*, not an
    // error) when it doesn't — so only `=== true` renders. A genuinely invalid rule throws, and the
    // catch surfaces it.
    try {
      if (check(branch.rule!, data) === true) return renderConditions(branch.body, data, onError);
    } catch (err) {
      const rendered = onRuleError(err instanceof Error ? err.message : 'Unknown error', branch.body, data, onError);
      if (rendered !== null) return rendered;
    }
  }
  return '';
};

function renderConditions(content: string, data: Record<string, unknown>, onError?: RuleErrorSink): string {
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
    result += renderBranches(block.branches, data, onError);
    i = block.end;
  }
  return result;
}

export const evaluateConditions = (content: string, variables: Variables, onError?: RuleErrorSink): string =>
  renderConditions(content, flattenVariables(variables), onError);
