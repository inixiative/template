/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */

import {
  evaluateTemplateBlocksAndTokens,
  type RuleErrorSink,
} from '@template/email/render/evaluateTemplate';
import { toScope, type Variables } from '@template/email/render/interpolate';
import type { EmailLens } from '@template/email/rules/emailLens';

export type { RuleErrorSink };

export const evaluateConditions = (
  content: string,
  variables: Variables,
  lens: EmailLens,
  onError?: RuleErrorSink,
  existingTargets?: ReadonlySet<string>,
): string =>
  evaluateTemplateBlocksAndTokens(
    content,
    toScope(variables),
    { substitute: false, existingTargets, lens },
    onError,
  );
