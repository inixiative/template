/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { END_EACH } from '@template/email/render/conditionParser';
import type { RuleErrorSink } from '@template/email/render/settle/types';

export const sinkOrphanEachCloses = (text: string, onError?: RuleErrorSink): void => {
  if (!onError) return;
  let idx = text.indexOf(END_EACH);
  while (idx !== -1) {
    onError('stray {{/each}} with no matching {{#each}}');
    idx = text.indexOf(END_EACH, idx + END_EACH.length);
  }
};
