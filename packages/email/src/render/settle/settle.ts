/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { EACH, IF, parseEachBlock, parseIfBlock } from '@template/email/render/conditionParser';
import { settleBranches } from '@template/email/render/settle/settleBranches';
import { settleEach } from '@template/email/render/settle/settleEach';
import { settleText } from '@template/email/render/settle/settleText';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';

export const settle = (content: string, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  let result = '';
  let i = 0;
  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) {
      result += settleText(content.slice(i), scope, options, onError);
      return result;
    }

    const isEach = eachIdx !== -1 && (ifIdx === -1 || eachIdx < ifIdx);
    const openIdx = isEach ? eachIdx : ifIdx;
    result += settleText(content.slice(i, openIdx), scope, options, onError);

    if (isEach) {
      const block = parseEachBlock(content, openIdx);
      if (!block) {
        onError?.('unterminated {{#each}} block - missing {{/each}}');
        result += settleText(content.slice(openIdx), scope, options, onError);
        return result;
      }
      result += settleEach(block, scope, options, onError);
      i = block.end;
    } else {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        result += settleText(content.slice(openIdx), scope, options, onError);
        return result;
      }
      result += settleBranches(block.branches, scope, options, onError);
      i = block.end;
    }
  }
  return result;
};
