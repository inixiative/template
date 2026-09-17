/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';

export type PreflightSeverity = 'error' | 'warning';

export type PreflightFinding = {
  code: string;
  severity: PreflightSeverity;
  message: string;
  location?: string;
};

export type PreflightInput = {
  mjml: string;
  subject: string;
  html: string;
  fieldPaths: readonly string[];
  renderWarnings: readonly string[];
  lens?: Lens | LensNarrowing;
  tokenUnresolvedSeverity?: PreflightSeverity;
};

export type PreflightCheck = (input: PreflightInput) => PreflightFinding[] | Promise<PreflightFinding[]>;

export type SyncPreflightCheck = (input: PreflightInput) => PreflightFinding[];

export type PreflightSummary = { errors: number; warnings: number };

export type PreflightResult = { findings: PreflightFinding[]; summary: PreflightSummary };
