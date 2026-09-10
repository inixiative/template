/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { ALL_PREFLIGHT_CHECKS } from '@template/email/preflight/checks';
import type { PreflightCheck, PreflightInput, PreflightResult } from '@template/email/preflight/types';

const SEVERITY_RANK = { error: 0, warning: 1 } as const;

export const runPreflight = async (
  input: PreflightInput,
  checks: readonly PreflightCheck[] = ALL_PREFLIGHT_CHECKS,
): Promise<PreflightResult> => {
  const results = await Promise.allSettled(checks.map((check) => Promise.resolve().then(() => check(input))));
  const findings = results
    .flatMap((result) =>
      result.status === 'fulfilled'
        ? result.value
        : [
            {
              code: 'preflight.failed',
              severity: 'error' as const,
              message: `Preflight check failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
            },
          ],
    )
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return {
    findings,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
    },
  };
};
