/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */

import { eachMarkerAt } from '@template/email/render/conditionParser/eachMarkerAt';
import { END, END_EACH, IF } from '@template/email/render/conditionParser/grammar';
import {
  nextStructuralToken,
  type StructuralBlockKind,
} from '@template/email/render/conditionParser/nextStructuralToken';
import { ruleMarkerAt } from '@template/email/render/conditionParser/ruleMarkerAt';

export const findEachBodyEnd = (content: string, bodyStart: number): number => {
  const stack: StructuralBlockKind[] = ['each'];
  let i = bodyStart;

  while (stack.length > 0) {
    const token = nextStructuralToken(content, i);
    if (!token) return -1;

    if (!token.isClose) {
      stack.push(token.kind);
      if (token.kind === 'if') {
        const marker = ruleMarkerAt(content, token.index, IF);
        i = marker ? marker.next : token.index + IF.length;
      } else {
        const marker = eachMarkerAt(content, token.index);
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
