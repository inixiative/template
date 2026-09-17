/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */

import type { PreflightFinding, SyncPreflightCheck } from '@template/email/preflight/types';
import { visibleText } from '@template/email/preflight/visibleText';

export const SPAM_TRIGGER_PHRASES = [
  'act now',
  'free money',
  '100% free',
  'click here',
  'guaranteed',
  'no obligation',
  'risk-free',
  'winner',
  'urgent',
  'limited time',
  'buy now',
  'earn extra cash',
  '!!!',
  '$$$',
] as const;

export const spamTriggerPhrases: SyncPreflightCheck = ({ subject, html }) => {
  const findings: PreflightFinding[] = [];
  const surfaces: [string, string][] = [
    ['subject', subject.toLowerCase()],
    ['body', visibleText(html).toLowerCase()],
  ];
  for (const [location, text] of surfaces) {
    for (const phrase of SPAM_TRIGGER_PHRASES) {
      if (!text.includes(phrase)) continue;
      findings.push({
        code: 'spam.trigger',
        severity: 'warning',
        message: `"${phrase}" is a common spam-filter trigger.`,
        location,
      });
    }
  }
  return findings;
};
