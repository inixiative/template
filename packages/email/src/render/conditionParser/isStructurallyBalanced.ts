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

export const isStructurallyBalanced = (text: string): boolean => {
  const stack: Kind[] = [];
  let i = 0;

  while (true) {
    const token = nextStructuralToken(text, i);
    if (!token) return stack.length === 0;

    if (!token.isClose) {
      stack.push(token.kind);
      if (token.kind === 'if') {
        const marker = readRuleMarker(text, token.index, IF);
        i = marker ? marker.next : token.index + IF.length;
      } else {
        const marker = readEachMarker(text, token.index);
        if (!marker) return false;
        i = marker.next;
      }
      continue;
    }

    if (stack.at(-1) !== token.kind) return false;
    stack.pop();
    i = token.index + (token.kind === 'if' ? END.length : END_EACH.length);
  }
};
