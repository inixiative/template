/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { PreflightFinding, SyncPreflightCheck } from '@template/email/preflight/types';
import { collectJsonOpacityWarnings } from '@template/email/rules/collectJsonOpacityWarnings';
import { checkExpectations } from '@template/email/rules/componentExpectations';

export const unresolvedLensPaths: SyncPreflightCheck = ({ fieldPaths, lens, tokenUnresolvedSeverity = 'error' }) => {
  if (!lens) return [];
  const findings: PreflightFinding[] = checkExpectations([...fieldPaths], lens)
    .filter((check) => !check.ok)
    .map((check) => ({
      code: 'token.unresolved',
      severity: tokenUnresolvedSeverity,
      message: `{{${check.path}}} does not resolve for this template's recipient, sender or data.`,
      location: check.path,
    }));
  for (const message of collectJsonOpacityWarnings([...fieldPaths], lens)) {
    findings.push({ code: 'token.opaque', severity: 'warning', message, location: 'mjml' });
  }
  return findings;
};
