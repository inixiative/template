/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { TOKEN_PATTERN, visitTextSegments } from '@template/email/render/conditionParser';
import { substituteDatetimeToken } from '@template/email/render/evaluateTemplate/substituteDatetimeToken';
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
  let out = '';
  visitTextSegments(text, {
    text: (slice) => {
      out += slice.replace(TOKEN_PATTERN, (_match, root: string, segments: string) =>
        substituteToken(root, segments, scope, onError, options),
      );
    },
    datetime: (token) => {
      out += substituteDatetimeToken(token, scope, onError, options);
    },
  });
  return out;
};
