/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { type Transition, validateTransition } from '@inixiative/transitions';

export type MatrixIssue = { path: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const validateMatrix = (matrix: unknown): MatrixIssue[] => {
  if (matrix === null || matrix === undefined) return [];

  if (!isRecord(matrix) || !('paths' in matrix)) {
    return [{ path: '$', message: 'matrix must be an Action object with a `paths` array' }];
  }
  const { paths } = matrix;
  if (!Array.isArray(paths)) return [{ path: '$.paths', message: 'matrix.paths must be an array' }];
  if (paths.length === 0) {
    return [{ path: '$.paths', message: 'matrix must declare at least one sender→recipient path' }];
  }

  const issues: MatrixIssue[] = [];
  paths.forEach((path, i) => {
    const result = validateTransition(path as Transition, { requireSerializable: true });
    for (const err of result.errors) issues.push({ path: `$.paths[${i}].${err.path}`, message: err.message });
  });
  return issues;
};

export class MatrixValidationError extends Error {
  readonly issues: MatrixIssue[];

  constructor(issues: MatrixIssue[]) {
    super(`Invalid send matrix:\n${issues.map((x) => `  ${x.path}: ${x.message}`).join('\n')}`);
    this.name = 'MatrixValidationError';
    this.issues = issues;
  }
}

export const assertValidMatrix = (matrix: unknown): void => {
  const issues = validateMatrix(matrix);
  if (issues.length > 0) throw new MatrixValidationError(issues);
};
