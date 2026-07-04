/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { validateRule } from '@inixiative/json-rules';

export type LensIssue = { path: string; message: string };

const RECIPIENT_LEAF = ['id', 'name', 'email'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateLens = (lens: unknown, path: string, requireUserLeaf: boolean, issues: LensIssue[]): void => {
  if (!isRecord(lens)) {
    issues.push({ path, message: 'lens must be an object' });
    return;
  }
  if (typeof lens.parent !== 'string' || lens.parent.length === 0) {
    issues.push({ path: `${path}.parent`, message: 'lens must declare a parent model' });
  }
  if (lens.picks !== undefined && !(Array.isArray(lens.picks) && lens.picks.every((p) => typeof p === 'string'))) {
    issues.push({ path: `${path}.picks`, message: 'picks must be an array of field names' });
  }
  if (lens.bindings !== undefined && !isRecord(lens.bindings)) {
    issues.push({ path: `${path}.bindings`, message: 'bindings must be an object' });
  }
  if (lens.where !== undefined) {
    if (!isRecord(lens.where)) {
      issues.push({ path: `${path}.where`, message: 'where must be a condition object' });
    } else {
      for (const err of validateRule(lens.where).errors)
        issues.push({ path: `${path}.where.${err.path}`, message: err.message });
    }
  }
  if (requireUserLeaf) {
    if (lens.parent !== 'User') {
      issues.push({ path: `${path}.parent`, message: 'recipient lenses must be parent: User (reason out via relations)' });
    }
    const picks = Array.isArray(lens.picks) ? lens.picks : [];
    const missing = RECIPIENT_LEAF.filter((leaf) => !picks.includes(leaf));
    if (missing.length) {
      issues.push({ path: `${path}.picks`, message: `recipient lens must pick the delivery leaf (${missing.join(', ')})` });
    }
  }
};

export const validateLenses = (lenses: unknown): LensIssue[] => {
  if (lenses === null || lenses === undefined) return [];
  if (!isRecord(lenses)) return [{ path: '$', message: 'lenses must be an object with `senders` and `recipients` maps' }];

  const issues: LensIssue[] = [];
  for (const side of ['senders', 'recipients'] as const) {
    const group = lenses[side];
    if (!isRecord(group)) {
      issues.push({ path: `$.${side}`, message: `${side} must be a map of named lenses` });
      continue;
    }
    for (const [key, lens] of Object.entries(group))
      validateLens(lens, `$.${side}.${key}`, side === 'recipients', issues);
  }
  return issues;
};

export class LensesValidationError extends Error {
  readonly issues: LensIssue[];

  constructor(issues: LensIssue[]) {
    super(`Invalid template lenses:\n${issues.map((x) => `  ${x.path}: ${x.message}`).join('\n')}`);
    this.name = 'LensesValidationError';
    this.issues = issues;
  }
}

export const assertValidLenses = (lenses: unknown): void => {
  const issues = validateLenses(lenses);
  if (issues.length > 0) throw new LensesValidationError(issues);
};
