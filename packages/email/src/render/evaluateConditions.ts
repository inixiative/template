/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import { type Branch, IF, parseIfBlock } from '@template/email/render/conditionParser';
import type { Variables } from '@template/email/render/interpolate';
import { referenceKey, ruleReferences } from '@template/email/rules/ruleReferences';

// Notified once per render-time rule throw (malformed/uncheckable rule). The caller decides what to
// do with it (log it, apply the template's error policy) — the evaluator stays free of those concerns.
export type RuleErrorSink = (message: string) => void;

// Debug override: emit the offending block inline (HTML comment + body) so a broken template is
// visible in a rendered preview. Off by default and independent of ENVIRONMENT — the error still
// reaches `onError` regardless. Read at call time so a test can toggle it without import ordering.
const inlineRenderErrors = (): boolean => process.env.EMAIL_INLINE_RENDER_ERRORS === 'true';

// Rules evaluate over the nested { sender, recipient, data } object: `check` resolves dotted
// paths by nested descent (lodash get), so `recipient.account.id` reaches through to-one
// relations. A dotted path CROSSING a to-many still resolves to undefined — address a list
// with its own relation node (arrayOperator / aggregate); the save-time vocabulary gate and
// the extraction both treat that as the canonical spelling.
const ruleData = (variables: Variables): Record<string, unknown> => ({
  sender: variables.sender,
  recipient: variables.recipient,
  data: variables.data,
});

// A malformed/uncheckable rule is always reported via `onError`. With the inline-debug flag on it is
// also surfaced (with its body) in the output; otherwise the branch is skipped (the next branch is
// tried, degrading the block) — the signal lives in `onError`, not the rendered bytes.
const onRuleError = (
  message: string,
  body: string,
  data: Record<string, unknown>,
  onError?: RuleErrorSink,
  liveRefs?: ReadonlySet<string>,
): string | null => {
  onError?.(message);
  return inlineRenderErrors()
    ? `<!-- RULE ERROR: ${message} -->\n${renderConditions(body, data, onError, liveRefs)}`
    : null;
};

// Render the first branch whose rule matches (recursing for nested blocks); bare `{{else}}` is the
// fallback; nothing if no branch matches and there is no else.
const renderBranches = (
  branches: Branch[],
  data: Record<string, unknown>,
  onError?: RuleErrorSink,
  liveRefs?: ReadonlySet<string>,
): string => {
  for (const branch of branches) {
    if (branch.kind === 'else') return renderConditions(branch.body, data, onError, liveRefs);

    if (branch.ruleError !== undefined) {
      const rendered = onRuleError(branch.ruleError, branch.body, data, onError, liveRefs);
      if (rendered !== null) return rendered;
      continue;
    }

    const { references, dynamic } = ruleReferences(branch.rule!);
    // why: absence is stale, so a reference the liveness pass never confirmed fails closed. The
    // why: undefined set means the caller did not ask, which is the standalone-render case.
    const stale = liveRefs && references.find((reference) => !liveRefs.has(referenceKey(reference)));
    if (dynamic || stale) {
      const message = stale
        ? `rule names a ${stale.model} that no longer resolves: ${stale.id}`
        : 'rule reads a referenced row from path or bind, or describes it without naming it — refusing to evaluate';
      const rendered = onRuleError(message, branch.body, data, onError, liveRefs);
      if (rendered !== null) return rendered;
      continue;
    }

    // `check` returns `true` on match, or a string explaining the mismatch (a *reason*, not an
    // error) when it doesn't — so only `=== true` renders. A genuinely invalid rule throws, and the
    // catch surfaces it.
    try {
      if (check(branch.rule!, data) === true) return renderConditions(branch.body, data, onError, liveRefs);
    } catch (err) {
      const rendered = onRuleError(
        err instanceof Error ? err.message : 'Unknown error',
        branch.body,
        data,
        onError,
        liveRefs,
      );
      if (rendered !== null) return rendered;
    }
  }
  return '';
};

function renderConditions(
  content: string,
  data: Record<string, unknown>,
  onError?: RuleErrorSink,
  liveRefs?: ReadonlySet<string>,
): string {
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
      onError?.('unterminated {{#if}} block — the marker and everything after it was suppressed');
      break;
    }
    result += renderBranches(block.branches, data, onError, liveRefs);
    i = block.end;
  }
  return result;
}

export const evaluateConditions = (
  content: string,
  variables: Variables,
  onError?: RuleErrorSink,
  liveRefs?: ReadonlySet<string>,
): string => renderConditions(content, ruleData(variables), onError, liveRefs);
