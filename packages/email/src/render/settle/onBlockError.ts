/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { inlineRenderErrors } from '@template/email/render/settle/inlineRenderErrors';
import { settle } from '@template/email/render/settle/settle';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';

export const onBlockError = (
  message: string,
  body: string,
  scope: Scope,
  options: SettleOptions,
  onError?: RuleErrorSink,
): string | null => {
  onError?.(message);
  return inlineRenderErrors() ? `<!-- RULE ERROR: ${message} -->\n${settle(body, scope, options, onError)}` : null;
};
