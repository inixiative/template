/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  nextTemplateBlockAt,
  parseEachBlock,
  parseIfBlock,
} from '@template/email/render/conditionParser';
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
    const nextBlock = nextTemplateBlockAt(content, i);
    if (!nextBlock) {
      result += substituteTokensInText(content.slice(i), scope, options, onError);
      return result;
    }

    const { kind, openIdx } = nextBlock;
    result += substituteTokensInText(content.slice(i, openIdx), scope, options, onError);

    if (kind === 'each') {
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
