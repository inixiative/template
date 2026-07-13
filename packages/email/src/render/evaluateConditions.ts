/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { toScope, type Variables } from '@template/email/render/interpolate';
import { type RuleErrorSink, settle } from '@template/email/render/settle';

export type { RuleErrorSink };

export const evaluateConditions = (content: string, variables: Variables, onError?: RuleErrorSink): string =>
  settle(content, toScope(variables), { substitute: false }, onError);
