/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { EACH, IF, parseEachBlock, parseIfBlock } from '@template/email/render/conditionParser';
import { evaluateEachBlock } from '@template/email/render/evaluateTemplate/evaluateEachBlock';
import { evaluateIfBranches } from '@template/email/render/evaluateTemplate/evaluateIfBranches';
import { substituteTokensInText } from '@template/email/render/evaluateTemplate/substituteTokensInText';
import type {
  RuleErrorSink,
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';

export const evaluateTemplateBlocksAndTokens = (
  content: string,
  scope: Scope,
  options: TemplateEvaluationOptions,
  onError?: RuleErrorSink,
): string => {
  let result = '';
  let i = 0;
  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) {
      result += substituteTokensInText(content.slice(i), scope, options, onError);
      return result;
    }

    const isEach = eachIdx !== -1 && (ifIdx === -1 || eachIdx < ifIdx);
    const openIdx = isEach ? eachIdx : ifIdx;
    result += substituteTokensInText(content.slice(i, openIdx), scope, options, onError);

    if (isEach) {
      const block = parseEachBlock(content, openIdx);
      if (!block) {
        onError?.({ kind: 'each', detail: 'unterminated {{#each}} block - missing {{/each}}' });
        result += substituteTokensInText(content.slice(openIdx), scope, options, onError);
        return result;
      }
      result += evaluateEachBlock(block, scope, options, onError);
      i = block.end;
    } else {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        onError?.({ kind: 'rule', detail: 'unterminated {{#if}} block - missing {{/if}}' });
        return result;
      }
      result += evaluateIfBranches(block.branches, scope, options, onError);
      i = block.end;
    }
  }
  return result;
};
