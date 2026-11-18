/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import { EACH, ELSE_IF, END, END_EACH, IF } from '@template/email/render/conditionParser/grammar';
import { ruleMarkerAt } from '@template/email/render/conditionParser/ruleMarkerAt';

export type StructuralBlockKind = 'if' | 'each';

export const nextStructuralToken = (
  content: string,
  i: number,
): { kind: StructuralBlockKind; isClose: boolean; index: number } | null => {
  for (let j = i; j < content.length; j++) {
    if (content.startsWith(EACH, j)) return { kind: 'each', isClose: false, index: j };
    if (content.startsWith(END_EACH, j)) return { kind: 'each', isClose: true, index: j };
    if (content.startsWith(END, j)) return { kind: 'if', isClose: true, index: j };
    if (content.startsWith(IF, j) && ruleMarkerAt(content, j, IF))
      return { kind: 'if', isClose: false, index: j };
    if (content.startsWith(ELSE_IF, j)) {
      const marker = ruleMarkerAt(content, j, ELSE_IF);
      if (marker) j = marker.next - 1;
    }
  }
  return null;
};
