/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { toScope, type Variables } from '@template/email/render/interpolate';
import { type RuleErrorSink, settle } from '@template/email/render/settle';
import type { EmailLens } from '@template/email/rules/emailLens';

export type { RuleErrorSink };

export const evaluateConditions = (
  content: string,
  variables: Variables,
  lens: EmailLens,
  onError?: RuleErrorSink,
  liveRefs?: ReadonlySet<string>,
): string => settle(content, toScope(variables), { substitute: false, liveRefs, lens }, onError);
