/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { EACH, IF } from '@template/email/render/conditionParser/grammar';
import { parseEachBlock } from '@template/email/render/conditionParser/parseEachBlock';
import { parseIfBlock } from '@template/email/render/conditionParser/parseIfBlock';
import type { Branch, EachBlock, IfBlock } from '@template/email/render/conditionParser/types';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';

export type TemplateBlockScope<S> = { bindings: BindingChain; state: S };

export type TemplateBlockPosition = { blockIndex: number; openIdx: number };

export type TemplateLoop = { iterated: string | undefined; bindings: BindingChain };

export type TemplateBlockVisitor<S> = {
  text?: (text: string, scope: TemplateBlockScope<S>) => void;
  unterminated?: (
    kind: 'if' | 'each',
    position: TemplateBlockPosition,
    scope: TemplateBlockScope<S>,
  ) => void;
  ifBlock?: (block: IfBlock, position: TemplateBlockPosition, scope: TemplateBlockScope<S>) => void;
  branch?: (
    branch: Branch,
    branchIndex: number,
    position: TemplateBlockPosition,
    scope: TemplateBlockScope<S>,
  ) => S | undefined;
  loop?: (
    block: EachBlock,
    loop: TemplateLoop,
    position: TemplateBlockPosition,
    scope: TemplateBlockScope<S>,
  ) => S | undefined;
};

export const visitTemplateBlocks = <S = undefined>(
  content: string,
  visitor: TemplateBlockVisitor<S>,
  scope: TemplateBlockScope<S> = { bindings: new Map(), state: undefined as S },
): void => {
  let i = 0;
  let blockIndex = 0;
  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) break;
    const kind: 'if' | 'each' = eachIdx === -1 || (ifIdx !== -1 && ifIdx < eachIdx) ? 'if' : 'each';
    const openIdx = kind === 'if' ? ifIdx : eachIdx;
    const position: TemplateBlockPosition = { blockIndex, openIdx };
    blockIndex++;

    visitor.text?.(content.slice(i, openIdx), scope);

    if (kind === 'if') {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        visitor.unterminated?.('if', position, scope);
        i = openIdx + IF.length;
        continue;
      }
      visitor.ifBlock?.(block, position, scope);
      block.branches.forEach((branch, branchIndex) => {
        const state = visitor.branch?.(branch, branchIndex, position, scope) ?? scope.state;
        visitTemplateBlocks(branch.body, visitor, { bindings: scope.bindings, state });
      });
      i = block.end;
      continue;
    }

    const block = parseEachBlock(content, openIdx);
    if (!block) {
      visitor.unterminated?.('each', position, scope);
      i = openIdx + EACH.length;
      continue;
    }
    const iterated = resolveBindingPath(block.path, scope.bindings);
    const bindings: BindingChain = new Map(scope.bindings);
    if (block.as) bindings.set(block.as, iterated);
    if (block.index) bindings.set(block.index, undefined);
    const state = visitor.loop?.(block, { iterated, bindings }, position, scope) ?? scope.state;
    visitTemplateBlocks(block.body, visitor, { bindings, state });
    i = block.end;
  }

  visitor.text?.(content.slice(i), scope);
};
