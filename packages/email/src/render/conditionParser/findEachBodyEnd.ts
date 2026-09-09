/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import { END, END_EACH, IF } from '@template/email/render/conditionParser/grammar';
import { type Kind, nextStructuralToken } from '@template/email/render/conditionParser/nextStructuralToken';
import { readEachMarker } from '@template/email/render/conditionParser/readEachMarker';
import { readRuleMarker } from '@template/email/render/conditionParser/readRuleMarker';

export const findEachBodyEnd = (content: string, bodyStart: number): number => {
  const stack: Kind[] = ['each'];
  let i = bodyStart;

  while (stack.length > 0) {
    const token = nextStructuralToken(content, i);
    if (!token) return -1;

    if (!token.isClose) {
      stack.push(token.kind);
      if (token.kind === 'if') {
        const marker = readRuleMarker(content, token.index, IF);
        i = marker ? marker.next : token.index + IF.length;
      } else {
        const marker = readEachMarker(content, token.index);
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
