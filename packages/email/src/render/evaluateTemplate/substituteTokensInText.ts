/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { TOKEN_PATTERN } from '@template/email/render/conditionParser';
import { substituteToken } from '@template/email/render/evaluateTemplate/substituteToken';
import type {
  RuleErrorSink,
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';

export const substituteTokensInText = (
  text: string,
  scope: Scope,
  options: TemplateEvaluationOptions,
  onError?: RuleErrorSink,
): string => {
  if (!options.substitute) return text;
  return text.replace(TOKEN_PATTERN, (_match, root: string, segments: string) =>
    substituteToken(root, segments, scope, onError, options),
  );
};
