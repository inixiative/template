/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { TOKEN_PATTERN } from '@template/email/render/conditionParser';
import { substituteToken } from '@template/email/render/settle/substituteToken';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';

export const settleText = (text: string, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  if (!options.substitute) return text;
  return text.replace(TOKEN_PATTERN, (_match, root: string, segments: string) =>
    substituteToken(root, segments, scope, onError),
  );
};
